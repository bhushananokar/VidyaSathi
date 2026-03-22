import uuid
import asyncio
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, Request, UploadFile, File, Form, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db, Textbook
from ..models.schemas import TextbookStatus
from ..utils.auth import get_current_student
from ..services.ingestion_service import IngestionService
from ..config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])
settings = get_settings()


async def _run_ingestion(textbook_id: str, file_path: str, meta: dict):
    """Background task for PDF processing."""
    from ..database import AsyncSessionLocal
    from ..services.gemini_service import GeminiService
    from ..services.chromadb_service import ChromaDBService
    from ..services.cache_service import CacheService
    # Services are re-created here since background tasks can't access app state easily
    gemini = GeminiService()
    chromadb = ChromaDBService()
    # Cache without redis in background (optional)
    try:
        async with AsyncSessionLocal() as db:
            svc = IngestionService(gemini, chromadb, None)
            await svc.process_pdf(file_path, textbook_id, meta, db)
    except Exception as e:
        logger.error(f"Background ingestion failed: {e}")


@router.post("/textbook/upload")
async def upload_textbook(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    title: str = Form(...),
    subject: str = Form("Science"),
    grade: int = Form(10),
    board: str = Form("CBSE"),
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save file
    upload_dir = Path("./uploads")
    upload_dir.mkdir(exist_ok=True)
    textbook_id = str(uuid.uuid4())
    file_path = upload_dir / f"{textbook_id}.pdf"

    content = await file.read()
    file_path.write_bytes(content)

    # Create DB record
    textbook = Textbook(
        id=textbook_id,
        title=title,
        subject=subject,
        grade=grade,
        board=board,
        status="processing",
        file_path=str(file_path),
    )
    db.add(textbook)
    await db.commit()

    meta = {"subject": subject, "grade": grade, "board": board, "title": title}
    background_tasks.add_task(_run_ingestion, textbook_id, str(file_path), meta)

    return {"textbook_id": textbook_id, "message": "Upload received. Processing in background."}


@router.get("/textbook/list", response_model=list[TextbookStatus])
async def list_textbooks(student=Depends(get_current_student), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Textbook).order_by(Textbook.created_at.desc()))
    return result.scalars().all()


@router.get("/textbook/status/{textbook_id}", response_model=TextbookStatus)
async def get_status(textbook_id: str, student=Depends(get_current_student), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Textbook).where(Textbook.id == textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")
    return tb


@router.post("/textbook/generate-qa/{textbook_id}/{chapter}")
async def generate_qa(
    textbook_id: str,
    chapter: int,
    request: Request,
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    svc: IngestionService = request.app.state.ingestion_service
    pairs = await svc.generate_qa_pairs(textbook_id, chapter, db)
    return {"count": len(pairs), "message": f"Generated {len(pairs)} Q&A pairs for Chapter {chapter}"}


@router.post("/textbook/generate-pack/{textbook_id}/{chapter}")
async def generate_pack(
    textbook_id: str,
    chapter: int,
    request: Request,
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Textbook).where(Textbook.id == textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    svc: IngestionService = request.app.state.ingestion_service
    file_path = await svc.generate_content_pack(
        textbook_id, chapter,
        {"subject": tb.subject, "grade": tb.grade, "board": tb.board},
        [],
        db,
    )
    return {"pack_id": file_path, "message": "Content pack generated"}


@router.delete("/textbook/{textbook_id}")
async def delete_textbook(
    textbook_id: str,
    request: Request,
    student=Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Textbook).where(Textbook.id == textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    chromadb = request.app.state.chromadb_service
    await chromadb.delete_textbook_chunks(textbook_id)

    await db.delete(tb)
    await db.commit()
    return {"message": "Deleted"}
