import uuid
import logging
import json
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db, Textbook, QuizAttempt, Student
from ..models.schemas import QuizQuestion, QuizResult, QuizGenerateRequest, QuizSubmitRequest, Flashcard, RevisionSummary, PerQuestionResult
from ..utils.auth import get_current_student

logger = logging.getLogger(__name__)
router = APIRouter(tags=["quiz"])


async def _generate_questions(gemini, textbook: Textbook, chapter: int, difficulty: str, count: int) -> list[dict]:
    prompt = f"""Generate {count} educational quiz questions for Chapter {chapter} of {textbook.subject} (Grade {textbook.grade}, {textbook.board}).

Difficulty: {difficulty}

Return a valid JSON array. Each question must have this exact structure:
{{
  "id": "q1",
  "type": "mcq",
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correct_answer": "A",
  "explanation": "...",
  "difficulty": "{difficulty if difficulty != 'adaptive' else 'medium'}",
  "topic": "Chapter {chapter}"
}}

Also include 2-3 true/false questions with type "true_false" (no options array, correct_answer is "True" or "False").

Return ONLY the JSON array, nothing else."""

    text, _ = await gemini.generate_flash(prompt)
    # Extract JSON
    import re
    match = re.search(r"\[[\s\S]*\]", text)
    if not match:
        # Return demo questions
        return _demo_questions(chapter, difficulty, count)
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        return _demo_questions(chapter, difficulty, count)


def _demo_questions(chapter: int, difficulty: str, count: int) -> list[dict]:
    return [{
        "id": f"q{i+1}",
        "type": "mcq",
        "question": f"Sample question {i+1} for Chapter {chapter}",
        "options": ["A. Option A", "B. Option B", "C. Option C", "D. Option D"],
        "correct_answer": "A",
        "explanation": "This is a sample explanation. Upload a textbook for real questions.",
        "difficulty": difficulty if difficulty != "adaptive" else "medium",
        "topic": f"Chapter {chapter}",
    } for i in range(count)]


@router.post("/quiz/generate", response_model=list[QuizQuestion])
async def generate_quiz(
    req: QuizGenerateRequest,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Textbook).where(Textbook.id == req.textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    gemini = request.app.state.gemini_service
    questions_data = await _generate_questions(gemini, tb, req.chapter, req.difficulty, req.count)

    questions = []
    for q in questions_data[:req.count]:
        try:
            questions.append(QuizQuestion(
                id=q.get("id", str(uuid.uuid4())),
                type=q.get("type", "mcq"),
                question=q.get("question", ""),
                options=q.get("options"),
                correct_answer=q.get("correct_answer", ""),
                explanation=q.get("explanation", ""),
                difficulty=q.get("difficulty", "medium"),
                topic=q.get("topic", f"Chapter {req.chapter}"),
            ))
        except Exception:
            continue

    return questions


@router.post("/quiz/submit", response_model=QuizResult)
async def submit_quiz(
    req: QuizSubmitRequest,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    gemini = request.app.state.gemini_service

    # Re-generate questions to check answers (in production, store questions in session)
    result = await db.execute(select(Textbook).where(Textbook.id == req.textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    questions_data = await _generate_questions(gemini, tb, req.chapter, "medium", len(req.answers))
    questions_map = {q["id"]: q for q in questions_data}

    score = 0
    per_question = []
    weak_topics = []

    for ans in req.answers:
        qid = ans.get("question_id", "")
        student_answer = ans.get("answer", "")
        q = questions_map.get(qid, {})
        correct_answer = q.get("correct_answer", "")
        is_correct = student_answer.strip().upper() == correct_answer.strip().upper()

        if is_correct:
            score += 1
        else:
            topic = q.get("topic", "")
            if topic and topic not in weak_topics:
                weak_topics.append(topic)

        per_question.append(PerQuestionResult(
            question_id=qid,
            correct=is_correct,
            student_answer=student_answer,
            correct_answer=correct_answer,
            explanation=q.get("explanation", ""),
        ))

    total = max(1, len(req.answers))
    percentage = round((score / total) * 100, 1)
    xp_earned = score * 10 + (50 if percentage >= 80 else 20 if percentage >= 60 else 5)

    # Log quiz attempt
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        student_id=student.id,
        textbook_id=req.textbook_id,
        chapter=req.chapter,
        score=score,
        total=total,
        difficulty="mixed",
    )
    db.add(attempt)

    # Update student XP
    student.xp = (student.xp or 0) + xp_earned

    # Update streak
    from datetime import datetime, date
    today = date.today()
    last = student.last_active.date() if student.last_active else None
    if last is None or last < today:
        student.streak = (student.streak or 0) + 1 if last and (today - last).days == 1 else (1 if last != today else student.streak or 0)
    student.last_active = datetime.utcnow()

    # Upsert LearningProgress
    from ..database import LearningProgress
    prog_result = await db.execute(
        select(LearningProgress).where(
            LearningProgress.student_id == student.id,
            LearningProgress.textbook_id == req.textbook_id,
            LearningProgress.chapter_id == req.chapter,
        )
    )
    prog = prog_result.scalar_one_or_none()
    new_mastery = min(100.0, round(percentage, 1))
    if prog:
        prog.mastery_pct = max(prog.mastery_pct, new_mastery)
        prog.weak_topics = weak_topics[:5]
        prog.last_activity = datetime.utcnow()
    else:
        db.add(LearningProgress(
            id=str(uuid.uuid4()),
            student_id=student.id,
            textbook_id=req.textbook_id,
            chapter_id=req.chapter,
            mastery_pct=new_mastery,
            weak_topics=weak_topics[:5],
        ))

    await db.commit()

    return QuizResult(
        score=score,
        total=total,
        percentage=percentage,
        xp_earned=xp_earned,
        mastery_delta=min(20.0, percentage * 0.2),
        weak_topics=weak_topics[:5],
        per_question=per_question,
    )


@router.get("/quiz/flashcards/{textbook_id}/{chapter}", response_model=list[Flashcard])
async def get_flashcards(
    textbook_id: str,
    chapter: int,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Textbook).where(Textbook.id == textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    gemini = request.app.state.gemini_service
    prompt = f"""Generate 15 flashcards for Chapter {chapter} of {tb.subject} (Grade {tb.grade}).

Return a valid JSON array:
[{{"id":"f1","front":"Question or concept","back":"Answer or definition","topic":"subtopic","difficulty":"easy"}}]

Mix difficulties: 5 easy, 7 medium, 3 hard. Return ONLY the JSON array."""

    text, _ = await gemini.generate_flash(prompt)
    import re
    match = re.search(r"\[[\s\S]*\]", text)
    if not match:
        return [Flashcard(id=f"f{i}", front=f"Concept {i} from Chapter {chapter}", back="Review this chapter for details", topic=f"Chapter {chapter}", difficulty="medium") for i in range(1, 6)]

    try:
        cards_data = json.loads(match.group())
        return [
            Flashcard(
                id=c.get("id", str(uuid.uuid4())),
                front=c.get("front", ""),
                back=c.get("back", ""),
                topic=c.get("topic", f"Chapter {chapter}"),
                difficulty=c.get("difficulty", "medium"),
            )
            for c in cards_data[:20]
        ]
    except json.JSONDecodeError:
        return []


@router.get("/revision/summary/{textbook_id}/{chapter}", response_model=RevisionSummary)
async def get_revision_summary(
    textbook_id: str,
    chapter: int,
    request: Request,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Textbook).where(Textbook.id == textbook_id))
    tb = result.scalar_one_or_none()
    if not tb:
        raise HTTPException(status_code=404, detail="Textbook not found")

    gemini = request.app.state.gemini_service
    prompt = f"""Create a comprehensive revision summary for Chapter {chapter} of {tb.subject} (Grade {tb.grade}, {tb.board}).

Respond in this exact JSON format:
{{
  "chapter_title": "Chapter title here",
  "summary": "Detailed markdown summary with formulas, key concepts, and explanations. Use ## headings, bullet points, and **bold** for important terms.",
  "key_points": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"]
}}

Return ONLY the JSON, nothing else."""

    text, _ = await gemini.generate_pro(prompt)
    import re
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return RevisionSummary(
            summary=f"# Chapter {chapter} Revision\n\nUpload a textbook to get detailed revision summaries.",
            key_points=["Upload a textbook PDF for chapter-specific key points"],
            chapter_title=f"Chapter {chapter}",
        )
    try:
        data = json.loads(match.group())
        return RevisionSummary(
            summary=data.get("summary", ""),
            key_points=data.get("key_points", []),
            chapter_title=data.get("chapter_title", f"Chapter {chapter}"),
        )
    except json.JSONDecodeError:
        return RevisionSummary(summary=text, key_points=[], chapter_title=f"Chapter {chapter}")


@router.post("/quiz/award-xp")
async def award_xp(
    data: dict,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Award XP for client-side graded quizzes (e.g. notebook quizzes)."""
    xp_earned = int(data.get("xp_earned", 0))
    if xp_earned <= 0:
        return {"xp": student.xp, "streak": student.streak}

    student.xp = (student.xp or 0) + xp_earned

    from datetime import datetime, date
    today = date.today()
    last = student.last_active.date() if student.last_active else None
    if last is None or last < today:
        student.streak = (student.streak or 0) + 1 if last and (today - last).days == 1 else (1 if last != today else student.streak or 0)
    student.last_active = datetime.utcnow()

    await db.commit()
    return {"xp": student.xp, "streak": student.streak}


@router.post("/practice/hint")
async def get_hint(
    data: dict,
    request: Request,
    student: Student = Depends(get_current_student),
):
    problem = data.get("problem", "")
    hint_level = data.get("hint_level", 1)
    subject = data.get("subject", "Mathematics")

    gemini = request.app.state.gemini_service
    hint_instructions = {
        1: "Give a very subtle hint — just point toward the right approach without revealing the solution.",
        2: "Give a moderate hint — explain the first step clearly.",
        3: "Give a detailed hint — show the method clearly, but let the student complete the final calculation.",
    }

    prompt = f"""Problem: {problem}
Subject: {subject}
Hint level: {hint_level}/3

{hint_instructions.get(hint_level, hint_instructions[1])}

Keep your hint under 50 words."""

    text, _ = await gemini.generate_flash(prompt)
    return {"hint": text.strip(), "hint_level": hint_level}
