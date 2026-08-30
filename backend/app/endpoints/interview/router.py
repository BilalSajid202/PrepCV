import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database.models import InterviewSession, InterviewFeedback, User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user
from app.business_logic.interview_generator import generate_interview_questions
from app.business_logic.feedback_rag import save_interview_feedback
from app.schemas.interview import (
    InterviewGenerateRequest,
    InterviewSessionResponse,
    InterviewFeedbackSubmitRequest,
    InterviewFeedbackResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Interview Prep & Feedback"])


@router.post("/generate", response_model=InterviewSessionResponse)
async def generate_session_questions(
    req: InterviewGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Generate tailored 9–12 interview questions combining Company URL Intelligence (Tavily),
    target JD, candidate CV, and community feedback RAG loop (FR-13, FR-14, FR-21, FR-22).
    """
    try:
        session = await generate_interview_questions(
            db=db,
            user=current_user,
            company_name=req.company_name,
            job_title=req.job_title,
            company_url=req.company_url or "",
            jd_text=req.jd_text or "",
            resume_id=req.resume_id,
        )

        return InterviewSessionResponse(
            id=session.id,
            user_id=session.user_id,
            resume_id=session.resume_id,
            company_name=session.company_name,
            company_url=session.company_url,
            job_title=session.job_title,
            jd_text=session.jd_text,
            company_insights=session.company_insights or {},
            generated_questions=session.generated_questions or [],
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat(),
        )
    except Exception as e:
        logger.error(f"Error generating interview questions: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate interview questions: {str(e)}"
        )


@router.get("/sessions", response_model=List[InterviewSessionResponse])
async def list_interview_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List all interview prep sessions created by the user."""
    stmt = (
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id)
        .order_by(desc(InterviewSession.created_at))
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    return [
        InterviewSessionResponse(
            id=s.id,
            user_id=s.user_id,
            resume_id=s.resume_id,
            company_name=s.company_name,
            company_url=s.company_url,
            job_title=s.job_title,
            jd_text=s.jd_text,
            company_insights=s.company_insights or {},
            generated_questions=s.generated_questions or [],
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sessions
    ]


@router.get("/sessions/{session_id}", response_model=InterviewSessionResponse)
async def get_interview_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve details and question list for a specific interview session."""
    stmt = select(InterviewSession).where(
        InterviewSession.id == session_id,
        InterviewSession.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview session not found.")

    return InterviewSessionResponse(
        id=session.id,
        user_id=session.user_id,
        resume_id=session.resume_id,
        company_name=session.company_name,
        company_url=session.company_url,
        job_title=session.job_title,
        jd_text=session.jd_text,
        company_insights=session.company_insights or {},
        generated_questions=session.generated_questions or [],
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


@router.post("/feedback", response_model=InterviewFeedbackResponse)
async def submit_feedback(
    req: InterviewFeedbackSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Capture post-interview feedback (what questions were actually asked),
    auto-tag company/role/industry, and scrub PII for future RAG retrieval (FR-19, FR-20).
    """
    try:
        feedback = await save_interview_feedback(
            db=db,
            user_id=current_user.id,
            actual_questions_text=req.actual_questions_text,
            session_id=req.session_id,
            company_name=req.company_name,
            job_title=req.job_title,
            industry=req.industry,
        )

        return InterviewFeedbackResponse(
            id=feedback.id,
            session_id=feedback.session_id,
            user_id=feedback.user_id,
            actual_questions_text=feedback.actual_questions_text,
            anonymized_questions_text=feedback.anonymized_questions_text,
            extracted_questions=feedback.extracted_questions or [],
            company_tag=feedback.company_tag,
            role_tag=feedback.role_tag,
            industry_tag=feedback.industry_tag,
            created_at=feedback.created_at.isoformat(),
        )
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit feedback: {str(e)}"
        )


@router.get("/feedback", response_model=List[InterviewFeedbackResponse])
async def list_user_feedback(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List all interview feedback submitted by the user."""
    stmt = (
        select(InterviewFeedback)
        .where(InterviewFeedback.user_id == current_user.id)
        .order_by(desc(InterviewFeedback.created_at))
    )
    result = await db.execute(stmt)
    feedbacks = result.scalars().all()

    return [
        InterviewFeedbackResponse(
            id=fb.id,
            session_id=fb.session_id,
            user_id=fb.user_id,
            actual_questions_text=fb.actual_questions_text,
            anonymized_questions_text=fb.anonymized_questions_text,
            extracted_questions=fb.extracted_questions or [],
            company_tag=fb.company_tag,
            role_tag=fb.role_tag,
            industry_tag=fb.industry_tag,
            created_at=fb.created_at.isoformat(),
        )
        for fb in feedbacks
    ]
