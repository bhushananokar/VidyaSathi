from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped
from sqlalchemy import String, Integer, Float, Text, DateTime, JSON, func
from typing import AsyncGenerator
from .config import get_settings
import datetime

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,       # detect stale connections
    pool_size=10,
    max_overflow=20,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Student(Base):
    __tablename__ = "students"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    grade: Mapped[int] = mapped_column(Integer)
    board: Mapped[str] = mapped_column(String(100))
    school: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    learning_profile: Mapped[dict] = mapped_column(JSON, default=lambda: {"visual": 0.25, "auditory": 0.25, "read_write": 0.25, "kinesthetic": 0.25})
    xp: Mapped[int] = mapped_column(Integer, default=0)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    last_active: Mapped[datetime.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class Textbook(Base):
    __tablename__ = "textbooks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    subject: Mapped[str] = mapped_column(String(100))
    grade: Mapped[int] = mapped_column(Integer)
    board: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class QAPair(Base):
    __tablename__ = "qa_pairs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    textbook_id: Mapped[str] = mapped_column(String)
    chapter: Mapped[int] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    topic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class QueryLog(Base):
    __tablename__ = "query_log"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    student_id: Mapped[str | None] = mapped_column(String, nullable=True)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    cost_tier: Mapped[int] = mapped_column(Integer, default=2)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    cached: Mapped[bool] = mapped_column(default=False)
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True)
    chapter: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    student_id: Mapped[str | None] = mapped_column(String, nullable=True)
    textbook_id: Mapped[str] = mapped_column(String)
    chapter: Mapped[int] = mapped_column(Integer)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class LearningProgress(Base):
    __tablename__ = "learning_progress"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    student_id: Mapped[str] = mapped_column(String)
    textbook_id: Mapped[str] = mapped_column(String)
    chapter_id: Mapped[int] = mapped_column(Integer)
    mastery_pct: Mapped[float] = mapped_column(Float, default=0.0)
    weak_topics: Mapped[list] = mapped_column(JSON, default=list)
    last_activity: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class ContentPack(Base):
    __tablename__ = "content_packs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    textbook_id: Mapped[str] = mapped_column(String)
    chapter: Mapped[int] = mapped_column(Integer)
    chapter_title: Mapped[str] = mapped_column(String(300))
    version: Mapped[str] = mapped_column(String(20))
    file_path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class Notebook(Base):
    """A notebook is a named collection of sources (PDFs / text)."""
    __tablename__ = "notebooks"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    student_id: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # legacy columns kept for DB compat (original table has source_type NOT NULL)
    source_type: Mapped[str] = mapped_column(String(20), default="collection")
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # derived state (updated after each source ingest)
    status: Mapped[str] = mapped_column(String(20), default="empty")  # empty | processing | ready | error
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


class NotebookSource(Base):
    """A single document (PDF or text) belonging to a Notebook collection."""
    __tablename__ = "notebook_sources"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    notebook_id: Mapped[str] = mapped_column(String)
    student_id: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String(300))
    source_type: Mapped[str] = mapped_column(String(20), default="text")  # pdf | text
    status: Mapped[str] = mapped_column(String(20), default="processing")
    total_chunks: Mapped[int] = mapped_column(Integer, default=0)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, default=func.now())


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
