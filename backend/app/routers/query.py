import uuid
import logging
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from ..database import get_db, QueryLog, Student
from ..models.schemas import QueryRequest, QueryResponse, VoiceQueryResponse
from ..utils.auth import get_current_student
from ..services.query_router import QueryRouter
from ..services.groq_service import GroqService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/query", tags=["query"])


@router.post("/ask", response_model=QueryResponse)
async def ask(
    req: QueryRequest,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    query_router: QueryRouter = request.app.state.query_router
    if not query_router:
        raise HTTPException(status_code=503, detail="Query service not available")

    conversation_id = req.conversation_id or str(uuid.uuid4())
    learning_profile = student.learning_profile or {"visual": 0.25, "auditory": 0.25, "read_write": 0.25, "kinesthetic": 0.25}

    result = await query_router.route_query(
        question=req.question,
        subject=req.subject,
        chapter=req.chapter,
        mode=req.mode,
        conversation_history=[],
        learning_profile=learning_profile,
    )

    # Log the query
    log = QueryLog(
        id=str(uuid.uuid4()),
        student_id=student.id,
        question=req.question,
        answer=result["answer"],
        cost_tier=result["cost_tier"],
        tokens_used=result["tokens_used"],
        cost_usd=result["cost_usd"],
        cached=result["cached"],
        subject=req.subject,
        chapter=req.chapter,
        mode=req.mode,
    )
    db.add(log)
    await db.commit()

    return QueryResponse(
        answer=result["answer"],
        sources=result.get("sources", []),
        cost_tier=result["cost_tier"],
        cached=result["cached"],
        tokens_used=result["tokens_used"],
        cost_usd=result["cost_usd"],
        mermaid_diagram=result.get("mermaid_diagram"),
        conversation_id=conversation_id,
    )


@router.post("/voice")
async def voice_query(
    request: Request,
    audio: UploadFile = File(...),
    subject: str = Form("Science"),
    chapter: str = Form(None),
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    groq: GroqService = request.app.state.groq_service
    query_router: QueryRouter = request.app.state.query_router

    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio too short")

    # Transcribe
    transcript, detected_lang = await groq.transcribe(audio_bytes)
    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio")

    # Query
    learning_profile = student.learning_profile or {}
    chapter_int = int(chapter) if chapter and chapter.isdigit() else None

    result = await query_router.route_query(
        question=transcript,
        subject=subject,
        chapter=chapter_int,
        mode="ask",
        conversation_history=[],
        learning_profile=learning_profile,
    )

    # TTS
    audio_response = await groq.text_to_speech(result["answer"][:1000])
    audio_url = ""

    if audio_response:
        # Save temporarily and return URL (in production, use object storage)
        audio_id = str(uuid.uuid4())
        audio_path = f"/tmp/vs_audio_{audio_id}.mp3"
        with open(audio_path, "wb") as f:
            f.write(audio_response)
        audio_url = f"/api/query/audio/{audio_id}"

    # Log
    log = QueryLog(
        id=str(uuid.uuid4()),
        student_id=student.id,
        question=transcript,
        answer=result["answer"],
        cost_tier=result["cost_tier"],
        cost_usd=result["cost_usd"],
        cached=result["cached"],
        subject=subject,
        mode="voice",
    )
    db.add(log)
    await db.commit()

    return {
        "answer_text": result["answer"],
        "answer_audio_url": audio_url,
        "transcript": transcript,
        "detected_language": detected_lang,
        "cost_tier": result["cost_tier"],
        "cost_usd": result["cost_usd"],
    }


@router.get("/audio/{audio_id}")
async def get_audio(audio_id: str):
    """Serve TTS audio file."""
    audio_path = f"/tmp/vs_audio_{audio_id}.mp3"
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio not found")
    with open(audio_path, "rb") as f:
        content = f.read()
    return Response(content=content, media_type="audio/mpeg")


@router.get("/history")
async def get_history(
    limit: int = 20,
    offset: int = 0,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(QueryLog)
        .where(QueryLog.student_id == student.id)
        .order_by(desc(QueryLog.created_at))
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    return [{"id": l.id, "question": l.question, "answer": l.answer, "cost_tier": l.cost_tier,
             "cost_usd": l.cost_usd, "cached": l.cached, "created_at": l.created_at} for l in logs]


@router.post("/feedback")
async def submit_feedback(data: dict, student: Student = Depends(get_current_student)):
    # For future implementation (thumbs up/down on answers)
    return {"status": "ok"}
