import json
import logging
import re
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, desc

from app.database.models import InterviewFeedback, InterviewSession
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def anonymize_text(raw_text: str) -> str:
    """
    Sanitize and anonymize text by stripping personally identifying information (PII)
    such as emails, phone numbers, person names, and social links (per NFR-5, Section 7.2).
    """
    if not raw_text:
        return ""

    text = raw_text

    # 1. Strip email addresses
    text = re.sub(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", "[EMAIL]", text)

    # 2. Strip phone numbers
    text = re.sub(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", "[PHONE]", text)

    # 3. Strip URLs & social profiles
    text = re.sub(r"https?://\S+|www\.\S+|linkedin\.com/\S+|github\.com/\S+", "[LINK]", text, flags=re.IGNORECASE)

    # 4. Strip common salutations/introductions like "My name is John" or "I spoke with Sarah"
    text = re.sub(r"\b(?:my name is|i am|interviewer was|spoke with|recruiter was|referral from)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b", "[NAME]", text, flags=re.IGNORECASE)

    return text.strip()


def normalize_tag(val: Optional[str]) -> str:
    """Normalize tags to lowercase alphanumeric for reliable SQL matching."""
    if not val:
        return ""
    clean = re.sub(r"[^a-zA-Z0-9\s-]", "", val).strip().lower()
    clean = re.sub(r"\s+", "-", clean)
    return clean[:50]


def parse_questions_from_text(raw_text: str) -> List[str]:
    """Parse pasted text into individual clean interview questions."""
    if not raw_text:
        return []

    lines = raw_text.split("\n")
    questions = []
    
    for line in lines:
        cleaned = re.sub(r"^[\d\.\-\*\•\)\s]+", "", line).strip()
        if len(cleaned) > 10:
            # Check if it ends in question mark or has question format
            if cleaned.endswith("?") or any(cleaned.lower().startswith(w) for w in ["how", "what", "why", "describe", "explain", "tell me", "can you", "have you", "write", "implement", "design"]):
                questions.append(cleaned)
            elif len(cleaned) > 20:
                questions.append(cleaned)

    if not questions and len(raw_text.strip()) > 15:
        questions = [raw_text.strip()]

    return questions[:15]


def infer_industry_from_role_and_company(job_title: str, company_name: str, jd_text: str = "") -> str:
    """Infer high-level industry category."""
    combined = f"{job_title} {company_name} {jd_text}".lower()
    
    if any(k in combined for k in ["fintech", "payment", "bank", "trading", "crypto", "stripe", "visa"]):
        return "Fintech"
    if any(k in combined for k in ["health", "medical", "biotech", "pharma", "clinical"]):
        return "Healthcare"
    if any(k in combined for k in ["e-commerce", "retail", "shop", "marketplace", "amazon", "shopify"]):
        return "E-Commerce"
    if any(k in combined for k in ["ai", "machine learning", "data science", "llm", "deep learning"]):
        return "Artificial Intelligence"
    if any(k in combined for k in ["cloud", "saas", "devops", "infrastructure", "security"]):
        return "Cloud & SaaS"
    if any(k in combined for k in ["game", "gaming", "unity", "unreal"]):
        return "Gaming"
        
    return "Technology"


async def save_interview_feedback(
    db: AsyncSession,
    user_id: str,
    actual_questions_text: str,
    session_id: Optional[str] = None,
    company_name: Optional[str] = None,
    job_title: Optional[str] = None,
    industry: Optional[str] = None,
) -> InterviewFeedback:
    """
    Capture post-interview feedback, anonymize PII, extract structured questions,
    and tag with company/role/industry (FR-19, FR-20).
    """
    # If session_id provided, fetch metadata if missing
    if session_id and (not company_name or not job_title):
        sess_stmt = select(InterviewSession).where(InterviewSession.id == session_id)
        res = await db.execute(sess_stmt)
        sess = res.scalar_one_or_none()
        if sess:
            if not company_name: company_name = sess.company_name
            if not job_title: job_title = sess.job_title

    company_clean = company_name.strip() if company_name else "General"
    role_clean = job_title.strip() if job_title else "Software Engineer"
    industry_clean = industry.strip() if industry else infer_industry_from_role_and_company(role_clean, company_clean)

    # Anonymize PII
    anonymized_text = anonymize_text(actual_questions_text)
    parsed_questions = parse_questions_from_text(anonymized_text)

    # Normalized tags
    company_tag = normalize_tag(company_clean)
    role_tag = normalize_tag(role_clean)
    industry_tag = normalize_tag(industry_clean)

    feedback_record = InterviewFeedback(
        session_id=session_id,
        user_id=user_id,
        actual_questions_text=actual_questions_text,
        anonymized_questions_text=anonymized_text,
        extracted_questions=parsed_questions,
        company_tag=company_tag,
        role_tag=role_tag,
        industry_tag=industry_tag,
    )
    db.add(feedback_record)
    await db.commit()
    await db.refresh(feedback_record)

    logger.info(f"Saved interview feedback {feedback_record.id} with tags company='{company_tag}', role='{role_tag}'")
    return feedback_record


async def retrieve_relevant_interview_feedback(
    db: AsyncSession,
    company_name: str,
    job_title: str,
    limit: int = 6,
) -> List[Dict[str, Any]]:
    """
    Retrieve anonymized real interview questions matching company or role (FR-21, FR-22).
    Used as few-shot RAG context during Step 8 question generation.
    """
    c_tag = normalize_tag(company_name)
    r_tag = normalize_tag(job_title)

    # 1. Search for matching company tag or role tag
    conditions = []
    if c_tag:
        conditions.append(InterviewFeedback.company_tag == c_tag)
    if r_tag:
        conditions.append(InterviewFeedback.role_tag.like(f"%{r_tag[:10]}%"))

    if not conditions:
        return []

    stmt = (
        select(InterviewFeedback)
        .where(or_(*conditions))
        .order_by(desc(InterviewFeedback.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    feedbacks = result.scalars().all()

    retrieved: List[Dict[str, Any]] = []
    seen_questions = set()

    for fb in feedbacks:
        for q in (fb.extracted_questions or []):
            clean_q = q.strip()
            if clean_q and clean_q.lower() not in seen_questions:
                seen_questions.add(clean_q.lower())
                retrieved.append({
                    "question": clean_q,
                    "company_tag": fb.company_tag,
                    "role_tag": fb.role_tag,
                    "industry_tag": fb.industry_tag,
                    "source": "verified_candidate_feedback",
                })
            if len(retrieved) >= limit:
                break
        if len(retrieved) >= limit:
            break

    logger.info(f"Retrieved {len(retrieved)} past real-interview questions for company='{company_name}', role='{job_title}'")
    return retrieved
