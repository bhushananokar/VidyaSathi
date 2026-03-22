import asyncio
import logging
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import Notebook, NotebookSource, get_db, Student
from ..utils.auth import get_current_student

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notebook", tags=["notebook"])

CHUNK_TARGET_TOKENS = 500
OVERLAP_SENTENCES = 2


# ── Chunking helpers ──────────────────────────────────────────────────────────

def _estimate_tokens(text: str) -> int:
    return int(len(text.split()) * 1.3)


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]


def _chunk_text(text: str, metadata: dict) -> list[dict]:
    sentences = _split_sentences(text)
    chunks, current, tokens = [], [], 0
    for sent in sentences:
        st = _estimate_tokens(sent)
        if tokens + st > CHUNK_TARGET_TOKENS and current:
            chunks.append({"id": str(uuid.uuid4()), "content": " ".join(current), "metadata": dict(metadata)})
            current = current[-OVERLAP_SENTENCES:]
            tokens = sum(_estimate_tokens(s) for s in current)
        current.append(sent)
        tokens += st
    if current:
        chunks.append({"id": str(uuid.uuid4()), "content": " ".join(current), "metadata": dict(metadata)})
    return chunks


# ── Notebook status helper ────────────────────────────────────────────────────

async def _refresh_notebook_status(notebook_id: str, db: AsyncSession):
    """Recompute notebook status and total_chunks from its sources."""
    result = await db.execute(
        select(NotebookSource).where(NotebookSource.notebook_id == notebook_id)
    )
    sources = result.scalars().all()
    if not sources:
        status, total = "empty", 0
    else:
        statuses = {s.status for s in sources}
        total = sum(s.total_chunks for s in sources)
        if "ready" in statuses:
            status = "ready"
        elif "processing" in statuses:
            status = "processing"
        else:
            status = "error"
    await db.execute(
        update(Notebook).where(Notebook.id == notebook_id).values(status=status, total_chunks=total)
    )
    await db.commit()


# ── Background ingestion ──────────────────────────────────────────────────────

async def _ingest_source(notebook_id: str, source_id: str, student_id: str, text: str, source_type: str, app):
    from ..database import AsyncSessionLocal
    gemini = app.state.gemini_service
    chroma = app.state.chromadb_service
    async with AsyncSessionLocal() as db:
        try:
            meta = {"notebook_id": notebook_id, "source_id": source_id, "student_id": student_id, "source_type": source_type}
            chunks = _chunk_text(text, meta)
            for i in range(0, len(chunks), 20):
                batch = chunks[i:i + 20]
                embeddings = await gemini.embed_batch([c["content"] for c in batch])
                for chunk, emb in zip(batch, embeddings):
                    chunk["embedding"] = emb
                await chroma.add_chunks(batch)
                await asyncio.sleep(0.05)
            await db.execute(
                update(NotebookSource).where(NotebookSource.id == source_id)
                .values(status="ready", total_chunks=len(chunks))
            )
            await db.commit()
            await _refresh_notebook_status(notebook_id, db)
            logger.info(f"Source {source_id}: {len(chunks)} chunks stored")
        except Exception as e:
            logger.error(f"Source ingest error: {e}")
            await db.execute(update(NotebookSource).where(NotebookSource.id == source_id).values(status="error"))
            await db.commit()
            await _refresh_notebook_status(notebook_id, db)


async def _ingest_pdf_source(notebook_id: str, source_id: str, student_id: str, file_path: str, app):
    try:
        import fitz
        doc = fitz.open(file_path)
        all_text = "\n\n".join(
            f"[Page {i+1}]\n{page.get_text('text')}"
            for i, page in enumerate(doc)
            if page.get_text("text").strip()
        )
        doc.close()
    except Exception as e:
        logger.error(f"PDF read error: {e}")
        from ..database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await db.execute(update(NotebookSource).where(NotebookSource.id == source_id).values(status="error"))
            await db.commit()
            await _refresh_notebook_status(notebook_id, db)
        return
    await _ingest_source(notebook_id, source_id, student_id, all_text, "pdf", app)


# ── Notebook (collection) routes ──────────────────────────────────────────────

@router.post("")
async def create_notebook(
    data: dict,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    title = data.get("title", "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    nb_id = str(uuid.uuid4())
    nb = Notebook(id=nb_id, student_id=student.id, title=title,
                  description=data.get("description") or None,
                  source_type="collection", status="empty")
    db.add(nb)
    await db.commit()
    return {"id": nb_id, "title": title, "status": "empty", "description": data.get("description")}


@router.get("/list")
async def list_notebooks(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notebook).where(Notebook.student_id == student.id).order_by(Notebook.created_at.desc())
    )
    notebooks = result.scalars().all()

    # Get source counts per notebook
    source_result = await db.execute(
        select(NotebookSource).where(NotebookSource.student_id == student.id)
    )
    sources = source_result.scalars().all()
    source_map: dict[str, list] = {}
    for s in sources:
        source_map.setdefault(s.notebook_id, []).append(s)

    return [
        {
            "id": nb.id, "title": nb.title, "description": nb.description,
            "status": nb.status, "total_chunks": nb.total_chunks,
            "source_count": len(source_map.get(nb.id, [])),
            "created_at": str(nb.created_at),
        }
        for nb in notebooks
    ]


@router.get("/{notebook_id}/status")
async def get_status(
    notebook_id: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return {"id": nb.id, "status": nb.status, "total_chunks": nb.total_chunks}


@router.delete("/{notebook_id}")
async def delete_notebook(
    notebook_id: str,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )
    nb = result.scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    # Remove all ChromaDB chunks for this notebook
    try:
        chroma = request.app.state.chromadb_service
        chroma.collection.delete(where={"notebook_id": notebook_id})
    except Exception as e:
        logger.warning(f"ChromaDB delete warning: {e}")

    # Remove source files
    src_result = await db.execute(select(NotebookSource).where(NotebookSource.notebook_id == notebook_id))
    for src in src_result.scalars().all():
        if src.file_path:
            Path(src.file_path).unlink(missing_ok=True)

    await db.execute(delete(NotebookSource).where(NotebookSource.notebook_id == notebook_id))
    await db.execute(delete(Notebook).where(Notebook.id == notebook_id))
    await db.commit()
    return {"status": "deleted"}


# ── Source routes (documents within a notebook) ───────────────────────────────

@router.get("/{notebook_id}/sources")
async def list_sources(
    notebook_id: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    result = await db.execute(
        select(NotebookSource).where(NotebookSource.notebook_id == notebook_id)
        .order_by(NotebookSource.created_at.asc())
    )
    return [
        {"id": s.id, "title": s.title, "source_type": s.source_type,
         "status": s.status, "total_chunks": s.total_chunks, "created_at": str(s.created_at)}
        for s in result.scalars().all()
    ]


@router.post("/{notebook_id}/source/upload")
async def add_pdf_source(
    notebook_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(""),
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    source_id = str(uuid.uuid4())
    doc_title = title.strip() or file.filename or "Untitled"
    upload_dir = Path("./uploads")
    upload_dir.mkdir(exist_ok=True)
    file_path = upload_dir / f"src_{source_id}.pdf"
    file_path.write_bytes(await file.read())

    src = NotebookSource(id=source_id, notebook_id=notebook_id, student_id=student.id,
                         title=doc_title, source_type="pdf", status="processing", file_path=str(file_path))
    db.add(src)
    await db.execute(update(Notebook).where(Notebook.id == notebook_id).values(status="processing"))
    await db.commit()

    background_tasks.add_task(_ingest_pdf_source, notebook_id, source_id, student.id, str(file_path), request.app)
    return {"id": source_id, "title": doc_title, "status": "processing", "source_type": "pdf"}


@router.post("/{notebook_id}/source/text")
async def add_text_source(
    notebook_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    data: dict,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")

    content = data.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")

    source_id = str(uuid.uuid4())
    doc_title = data.get("title", "Untitled Note").strip() or "Untitled Note"

    src = NotebookSource(id=source_id, notebook_id=notebook_id, student_id=student.id,
                         title=doc_title, source_type="text", status="processing")
    db.add(src)
    await db.execute(update(Notebook).where(Notebook.id == notebook_id).values(status="processing"))
    await db.commit()

    background_tasks.add_task(_ingest_source, notebook_id, source_id, student.id, content, "text", request.app)
    return {"id": source_id, "title": doc_title, "status": "processing", "source_type": "text"}


@router.delete("/{notebook_id}/source/{source_id}")
async def delete_source(
    notebook_id: str,
    source_id: str,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    src = (await db.execute(
        select(NotebookSource).where(
            NotebookSource.id == source_id,
            NotebookSource.notebook_id == notebook_id,
            NotebookSource.student_id == student.id,
        )
    )).scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")

    # Remove ChromaDB chunks for this source
    try:
        chroma = request.app.state.chromadb_service
        chroma.collection.delete(where={"source_id": source_id})
    except Exception as e:
        logger.warning(f"ChromaDB source delete warning: {e}")

    if src.file_path:
        Path(src.file_path).unlink(missing_ok=True)

    await db.execute(delete(NotebookSource).where(NotebookSource.id == source_id))
    await db.commit()
    await _refresh_notebook_status(notebook_id, db)
    return {"status": "deleted"}


# ── Ask / RAG ─────────────────────────────────────────────────────────────────

@router.post("/{notebook_id}/ask")
async def ask_notebook(
    notebook_id: str,
    data: dict,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if nb.status != "ready":
        raise HTTPException(status_code=400, detail="Notebook has no ready content yet")

    question = data.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    gemini = request.app.state.gemini_service
    chroma = request.app.state.chromadb_service

    query_emb = await gemini.embed_text(question)
    chunks = await chroma.search(query_embedding=query_emb, n_results=5,
                                  filters={"notebook_id": notebook_id})

    context = "\n\n---\n\n".join(c["content"] for c in chunks) if chunks else ""
    prompt = f"""You are an AI assistant answering questions strictly based on the user's notebook content.

NOTEBOOK: "{nb.title}"
{f'Description: {nb.description}' if nb.description else ''}

{"RELEVANT CONTENT FROM NOTEBOOK:" if context else "NOTE: No matching content found in this notebook for this question."}
{context}

Answer the question based on the notebook content. Be specific and cite relevant parts when possible.
If the answer is not in the notebook, clearly say "This isn't covered in your notebook" before answering from general knowledge.

Question: {question}"""

    answer, tokens = await gemini.generate_flash(prompt)
    sources = [{"content": c["content"][:200], "page": c["metadata"].get("page_no"), "score": round(1 - c["distance"], 3)} for c in chunks]
    return {"answer": answer, "sources": sources, "tokens_used": tokens, "notebook_title": nb.title}


# ── Bulk context helper ────────────────────────────────────────────────────────

async def _get_notebook_context(notebook_id: str, chroma, max_chunks: int = 40) -> str:
    try:
        results = chroma.collection.get(
            where={"notebook_id": notebook_id},
            include=["documents"],
            limit=max_chunks,
        )
        docs = results.get("documents") or []
        return "\n\n---\n\n".join(docs[:max_chunks])
    except Exception as e:
        logger.warning(f"Could not get notebook context: {e}")
        return ""


# ── Quiz / Flashcards / Summary ───────────────────────────────────────────────

@router.post("/{notebook_id}/quiz")
async def generate_notebook_quiz(
    notebook_id: str,
    data: dict,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if nb.status != "ready":
        raise HTTPException(status_code=400, detail="Notebook has no ready content yet")

    count = int(data.get("count", 10))
    gemini = request.app.state.gemini_service
    chroma = request.app.state.chromadb_service

    context = await _get_notebook_context(notebook_id, chroma)
    if not context:
        raise HTTPException(status_code=400, detail="No content found in notebook")

    prompt = f"""You are a quiz generator. Create {count} quiz questions based ONLY on the content below.
Notebook: "{nb.title}"

CONTENT:
{context[:6000]}

Generate exactly {count} questions in this JSON array format (no markdown, pure JSON):
[
  {{
    "id": "q1",
    "type": "mcq",
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "A",
    "explanation": "...",
    "difficulty": "easy",
    "topic": "..."
  }},
  {{
    "id": "q2",
    "type": "true_false",
    "question": "...",
    "correct_answer": "True",
    "explanation": "...",
    "difficulty": "medium",
    "topic": "..."
  }}
]

Rules:
- Mix types: mostly mcq, some true_false
- difficulty: easy/medium/hard (mix them)
- correct_answer for mcq must be the full text of the correct option (not A/B/C/D)
- options for mcq: exactly 4 items
- Base ALL questions strictly on the provided content
- Return ONLY the JSON array, no other text"""

    raw, _ = await gemini.generate_flash(prompt)
    import json as _json
    raw = raw.strip()
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        raw = raw.rsplit("```", 1)[0]
    try:
        questions = _json.loads(raw.strip())
        for i, q in enumerate(questions):
            q["id"] = str(uuid.uuid4())
        return questions
    except Exception as e:
        logger.error(f"Quiz JSON parse error: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=500, detail="Failed to parse generated quiz")


@router.get("/{notebook_id}/flashcards")
async def get_notebook_flashcards(
    notebook_id: str,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if nb.status != "ready":
        raise HTTPException(status_code=400, detail="Notebook has no ready content yet")

    gemini = request.app.state.gemini_service
    chroma = request.app.state.chromadb_service
    context = await _get_notebook_context(notebook_id, chroma)
    if not context:
        raise HTTPException(status_code=400, detail="No content found in notebook")

    import json as _json
    prompt = f"""Create 12 flashcards from this notebook content for spaced repetition study.
Notebook: "{nb.title}"

CONTENT:
{context[:5000]}

Return a JSON array only (no markdown):
[
  {{
    "id": "fc1",
    "front": "Question or term",
    "back": "Answer or definition",
    "topic": "topic name",
    "difficulty": "easy"
  }}
]

Rules:
- difficulty: easy/medium/hard
- front: concise question or key term (max 15 words)
- back: clear, complete answer (1-3 sentences)
- Cover the key concepts from the content
- Return ONLY JSON array"""

    raw, _ = await gemini.generate_flash(prompt)
    raw = raw.strip()
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        raw = raw.rsplit("```", 1)[0]
    try:
        cards = _json.loads(raw.strip())
        for card in cards:
            card["id"] = str(uuid.uuid4())
        return cards
    except Exception as e:
        logger.error(f"Flashcard JSON parse error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse flashcards")


@router.get("/{notebook_id}/summary")
async def get_notebook_summary(
    notebook_id: str,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    nb = (await db.execute(
        select(Notebook).where(Notebook.id == notebook_id, Notebook.student_id == student.id)
    )).scalar_one_or_none()
    if not nb:
        raise HTTPException(status_code=404, detail="Notebook not found")
    if nb.status != "ready":
        raise HTTPException(status_code=400, detail="Notebook has no ready content yet")

    gemini = request.app.state.gemini_service
    chroma = request.app.state.chromadb_service
    context = await _get_notebook_context(notebook_id, chroma, max_chunks=30)
    if not context:
        raise HTTPException(status_code=400, detail="No content found in notebook")

    prompt = f"""Summarize the following notebook content for a student.
Notebook title: "{nb.title}"

CONTENT:
{context[:5000]}

Provide:
1. A comprehensive summary (3-5 paragraphs with markdown formatting)
2. Exactly 8 key points (concise bullet points)

Format your response as:
SUMMARY:
[summary here]

KEY_POINTS:
- point 1
- point 2
..."""

    raw, _ = await gemini.generate_flash(prompt)
    summary = raw
    key_points: list[str] = []
    if "KEY_POINTS:" in raw:
        parts = raw.split("KEY_POINTS:", 1)
        summary = parts[0].replace("SUMMARY:", "").strip()
        kp_raw = parts[1].strip()
        key_points = [line.lstrip("- •*").strip() for line in kp_raw.split("\n") if line.strip() and line.strip().startswith(("-", "•", "*", "1", "2", "3", "4", "5", "6", "7", "8"))]
    elif "SUMMARY:" in raw:
        summary = raw.replace("SUMMARY:", "").strip()

    return {"summary": summary, "key_points": key_points[:8], "chapter_title": nb.title}
