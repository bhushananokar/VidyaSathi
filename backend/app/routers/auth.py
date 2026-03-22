import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db, Student
from ..models.schemas import StudentRegister, StudentLogin, StudentProfile, Token, LearningProfile
from ..utils.auth import hash_password, verify_password, create_access_token, get_current_student

router = APIRouter(prefix="/auth", tags=["auth"])


def _student_to_schema(s: Student) -> StudentProfile:
    profile_data = s.learning_profile or {"visual": 0.25, "auditory": 0.25, "read_write": 0.25, "kinesthetic": 0.25}
    return StudentProfile(
        id=s.id,
        name=s.name,
        grade=s.grade,
        board=s.board,
        school=s.school,
        learning_profile=LearningProfile(**profile_data),
        xp=s.xp,
        streak=s.streak,
        last_active=s.last_active,
        created_at=s.created_at,
    )


@router.post("/register", response_model=Token)
async def register(data: StudentRegister, db: AsyncSession = Depends(get_db)):
    # Check if name already taken
    result = await db.execute(select(Student).where(Student.name == data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Name already registered. Please choose a different name.")

    student = Student(
        id=str(uuid.uuid4()),
        name=data.name,
        grade=data.grade,
        board=data.board,
        school=data.school,
        hashed_password=hash_password(data.password),
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    token = create_access_token({"sub": student.id})
    return Token(access_token=token, student=_student_to_schema(student))


@router.post("/login", response_model=Token)
async def login(data: StudentLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Student).where(Student.name == data.name))
    student = result.scalar_one_or_none()
    if not student or not verify_password(data.password, student.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid name or password")

    token = create_access_token({"sub": student.id})
    return Token(access_token=token, student=_student_to_schema(student))


@router.get("/me", response_model=StudentProfile)
async def get_me(student: Student = Depends(get_current_student)):
    return _student_to_schema(student)


@router.put("/profile", response_model=StudentProfile)
async def update_profile(
    data: dict,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    if "learning_profile" in data:
        student.learning_profile = data["learning_profile"]
    if "school" in data:
        student.school = data["school"]
    await db.commit()
    await db.refresh(student)
    return _student_to_schema(student)


@router.post("/onboarding/assessment")
async def submit_assessment(
    data: dict,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Update learning profile from assessment responses."""
    responses = data.get("responses", [])
    if not responses:
        return {"profile": student.learning_profile}

    # Simple scoring: modality with fastest correct answers wins
    scores = {"visual": 0.0, "auditory": 0.0, "read_write": 0.0, "kinesthetic": 0.0}
    counts = {"visual": 0, "auditory": 0, "read_write": 0, "kinesthetic": 0}

    modality_map = {
        "q1": "read_write", "q2": "visual", "q3": "kinesthetic", "q4": "auditory",
        "q5": "visual", "q6": "kinesthetic", "q7": "read_write", "q8": "auditory",
    }

    for resp in responses:
        qid = resp.get("question_id", "")
        modality = modality_map.get(qid, "read_write")
        time_ms = max(1, resp.get("time_taken_ms", 10000))
        speed_bonus = min(2.0, 10000 / time_ms)
        score = speed_bonus  # correct answer checking is frontend-side
        scores[modality] += score
        counts[modality] += 1

    # Normalize
    for k in scores:
        scores[k] = scores[k] / max(1, counts[k])
    total = sum(scores.values()) or 1
    profile = {k: round(v / total, 3) for k, v in scores.items()}

    student.learning_profile = profile
    await db.commit()
    return {"profile": profile}


@router.get("/onboarding/profile")
async def get_profile(student: Student = Depends(get_current_student)):
    return {"profile": student.learning_profile}


@router.get("/onboarding/assessment-questions")
async def get_assessment_questions():
    # Return the 8 assessment questions (same as frontend hardcoded ones)
    return []
