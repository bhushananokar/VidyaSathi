from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class StudentRegister(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    grade: int = Field(ge=6, le=12)
    board: str
    school: Optional[str] = None
    password: str = Field(min_length=4)


class StudentLogin(BaseModel):
    name: str
    password: str


class LearningProfile(BaseModel):
    visual: float = 0.25
    auditory: float = 0.25
    read_write: float = 0.25
    kinesthetic: float = 0.25


class StudentProfile(BaseModel):
    id: str
    name: str
    grade: int
    board: str
    school: Optional[str] = None
    learning_profile: LearningProfile
    xp: int = 0
    streak: int = 0
    last_active: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    student: StudentProfile


# ── Textbook ──────────────────────────────────────────────────────────────────

class TextbookStatus(BaseModel):
    id: str
    title: str
    subject: str
    grade: int
    board: str
    status: Literal["pending", "processing", "ready", "error"]
    total_chunks: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


# ── Query ─────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    subject: str = "Science"
    chapter: Optional[int] = None
    mode: Literal["ask", "explain", "doubt", "solve", "quiz", "revision"] = "ask"
    conversation_id: Optional[str] = None


class MessageSource(BaseModel):
    chapter: str
    chapter_title: str
    topic: str
    page_no: Optional[int] = None
    textbook: str


class QueryResponse(BaseModel):
    answer: str
    sources: List[MessageSource] = []
    cost_tier: int  # 0=local, 1=semantic, 2=flash, 3=pro
    cached: bool = False
    tokens_used: int = 0
    cost_usd: float = 0.0
    mermaid_diagram: Optional[str] = None
    image_data: Optional[dict] = None
    conversation_id: str


class VoiceQueryResponse(BaseModel):
    answer_text: str
    answer_audio_url: str
    transcript: str
    detected_language: str
    cost_tier: int
    cost_usd: float


# ── Quiz ──────────────────────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    textbook_id: str
    chapter: int
    difficulty: Literal["easy", "medium", "hard", "adaptive"] = "adaptive"
    count: int = Field(default=10, ge=3, le=30)


class QuizQuestion(BaseModel):
    id: str
    type: Literal["mcq", "fill_blank", "true_false"]
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation: str
    difficulty: Literal["easy", "medium", "hard"]
    topic: str


class QuizSubmitRequest(BaseModel):
    textbook_id: str
    chapter: int
    answers: List[dict]  # [{question_id, answer}]


class PerQuestionResult(BaseModel):
    question_id: str
    correct: bool
    student_answer: str
    correct_answer: str
    explanation: str


class QuizResult(BaseModel):
    score: int
    total: int
    percentage: float
    xp_earned: int
    mastery_delta: float
    weak_topics: List[str] = []
    per_question: List[PerQuestionResult] = []


class Flashcard(BaseModel):
    id: str
    front: str
    back: str
    topic: str
    difficulty: Literal["easy", "medium", "hard"]


class RevisionSummary(BaseModel):
    summary: str
    key_points: List[str]
    chapter_title: str


# ── Offline / Sync ────────────────────────────────────────────────────────────

class ContentPackInfo(BaseModel):
    id: str
    textbook_id: str
    subject: str
    chapter: int
    chapter_title: str
    grade: int
    board: str
    version: str
    size_bytes: int
    created_at: datetime

    class Config:
        from_attributes = True


class BatchQueryRequest(BaseModel):
    queries: List[dict]  # [{question, subject, chapter?, mode}]


class BatchQueryResponse(BaseModel):
    answers: List[dict]  # [{question, answer}]


# ── Analytics ─────────────────────────────────────────────────────────────────

class ChapterMastery(BaseModel):
    chapter_id: int
    chapter_title: str
    subject: str
    mastery_pct: float
    weak_topics: List[str] = []
    last_activity: str


class CostReport(BaseModel):
    total_queries: int
    cached_queries: int
    flash_queries: int
    pro_queries: int
    total_cost_usd: float
    baseline_cost_usd: float
    savings_pct: float
    cache_hit_rate: float


class StudentDashboard(BaseModel):
    xp: int
    streak: int
    mastery: List[ChapterMastery] = []
    weak_topics: List[str] = []
    recent_activity: List[dict] = []


# ── Visual ────────────────────────────────────────────────────────────────────

class DiagramRequest(BaseModel):
    concept: str
    subject: str = "Science"
    diagram_type: Literal["flowchart", "mindmap", "sequence", "timeline", "graph"] = "flowchart"


class ConceptMapRequest(BaseModel):
    central_concept: str
    related_concepts: List[str]
    subject: str = "Science"


class FlowchartRequest(BaseModel):
    process_name: str
    steps: List[str]
    subject: str = "Science"


class ImageRequest(BaseModel):
    concept: str
    subject: str = "Science"
    style: str = "educational"


class DiagramResponse(BaseModel):
    type: Literal["mermaid", "svg", "description"]
    content: str
    alt_text: str
    diagram_type: str


# ── Onboarding ────────────────────────────────────────────────────────────────

class AssessmentQuestion(BaseModel):
    id: str
    concept: str
    modality: Literal["visual", "auditory", "read_write", "kinesthetic"]
    content: str
    type: Literal["text", "diagram", "steps"]
    options: List[str]
    correct: str


class AssessmentSubmit(BaseModel):
    responses: List[dict]  # [{question_id, answer, time_taken_ms}]
