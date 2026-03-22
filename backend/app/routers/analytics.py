from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Float, cast, Integer
from ..database import get_db, QueryLog, QuizAttempt, LearningProgress, Student
from ..models.schemas import CostReport, StudentDashboard
from ..utils.auth import get_current_student
from datetime import datetime, timedelta, date

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/student/dashboard")
async def get_student_dashboard(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    # Mastery data
    mastery_result = await db.execute(
        select(LearningProgress).where(LearningProgress.student_id == student.id)
    )
    mastery_rows = mastery_result.scalars().all()

    # Real recent activity: count queries per day for last 7 days
    recent_activity = []
    for i in range(6, -1, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count_result = await db.execute(
            select(func.count(QueryLog.id)).where(
                QueryLog.student_id == student.id,
                QueryLog.created_at >= day_start,
                QueryLog.created_at < day_end,
            )
        )
        recent_activity.append({
            "date": day.strftime("%Y-%m-%d"),
            "queries": count_result.scalar() or 0,
        })

    mastery = [
        {
            "chapter_id": m.chapter_id,
            "chapter_title": f"Chapter {m.chapter_id}",
            "subject": "Science",
            "mastery_pct": m.mastery_pct,
            "weak_topics": m.weak_topics or [],
            "last_activity": str(m.last_activity),
        }
        for m in mastery_rows
    ]

    return {
        "xp": student.xp,
        "streak": student.streak,
        "mastery": mastery,
        "weak_topics": [],
        "recent_activity": recent_activity,
    }


@router.get("/cost-report", response_model=CostReport)
async def get_cost_report(
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            func.count(QueryLog.id).label("total"),
            func.sum(QueryLog.cost_usd).label("total_cost"),
            func.sum(cast(QueryLog.cached, Integer)).label("cached_count"),
        ).where(QueryLog.student_id == student.id)
    )
    row = result.first()
    total = row.total or 0
    total_cost = float(row.total_cost or 0)
    cached_count = int(row.cached_count or 0)

    baseline_cost = total * 0.015
    flash_queries = max(0, total - cached_count - int(total * 0.1))
    pro_queries = int(total * 0.1)

    return CostReport(
        total_queries=total,
        cached_queries=cached_count,
        flash_queries=flash_queries,
        pro_queries=pro_queries,
        total_cost_usd=total_cost,
        baseline_cost_usd=baseline_cost,
        savings_pct=round(((baseline_cost - total_cost) / max(baseline_cost, 0.001)) * 100, 1),
        cache_hit_rate=round((cached_count / max(total, 1)) * 100, 1),
    )


@router.get("/teacher/class/{class_code}")
async def get_teacher_class(
    class_code: str,
    student: Student = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    return {
        "class_code": class_code,
        "student_count": 0,
        "avg_mastery": 0,
        "students": [],
        "top_weak_topics": [],
    }
