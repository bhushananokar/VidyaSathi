import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db, ContentPack, Textbook, Student
from ..models.schemas import ContentPackInfo
from ..utils.auth import get_current_student

logger = logging.getLogger(__name__)
router = APIRouter(tags=["offline"])


@router.get("/content-pack/list", response_model=list[ContentPackInfo])
async def list_content_packs(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ContentPack, Textbook)
        .join(Textbook, ContentPack.textbook_id == Textbook.id)
        .order_by(ContentPack.created_at.desc())
    )
    rows = result.all()
    packs = []
    for pack, tb in rows:
        packs.append(ContentPackInfo(
            id=pack.id,
            textbook_id=pack.textbook_id,
            subject=tb.subject,
            chapter=pack.chapter,
            chapter_title=pack.chapter_title,
            grade=tb.grade,
            board=tb.board,
            version=pack.version,
            size_bytes=pack.size_bytes,
            created_at=pack.created_at,
        ))
    return packs


@router.get("/content-pack/download/{pack_id}")
async def download_content_pack(
    pack_id: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ContentPack).where(ContentPack.id == pack_id))
    pack = result.scalar_one_or_none()
    if not pack:
        raise HTTPException(status_code=404, detail="Content pack not found")

    file_path = Path(pack.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Pack file not found on server")

    return FileResponse(
        path=str(file_path),
        media_type="application/octet-stream",
        filename=f"chapter_{pack.chapter}.pack",
    )


@router.post("/sync/batch-queries")
async def batch_sync_queries(
    data: dict,
    request: Request,
    student: Student = Depends(get_current_student),
):
    """Process queued offline questions."""
    queries = data.get("queries", [])
    if not queries:
        return {"answers": []}

    query_router = request.app.state.query_router
    answers = []

    for q in queries[:20]:  # limit batch size
        try:
            result = await query_router.route_query(
                question=q.get("question", ""),
                subject=q.get("subject", "Science"),
                chapter=q.get("chapter"),
                mode=q.get("mode", "ask"),
                conversation_history=[],
                learning_profile=student.learning_profile or {},
            )
            answers.append({"question": q["question"], "answer": result["answer"]})
        except Exception as e:
            logger.error(f"Batch query error: {e}")
            answers.append({"question": q.get("question", ""), "answer": "Sorry, I couldn't answer this question right now."})

    return {"answers": answers}


@router.post("/sync/push-progress")
async def push_progress(
    data: dict,
    student: Student = Depends(get_current_student),
):
    # Accept progress data from client; in full implementation, merge with server state
    return {"status": "ok", "synced": len(data.get("progress", []))}


@router.get("/sync/pull")
async def pull_updates(
    since: str = None,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Pull new Q&A pairs and progress updates since last sync."""
    from ..database import QAPair
    result = await db.execute(select(QAPair).limit(50))
    pairs = result.scalars().all()
    return {
        "qa_pairs": [{"question": p.question, "answer": p.answer} for p in pairs],
        "progress": [],
    }
