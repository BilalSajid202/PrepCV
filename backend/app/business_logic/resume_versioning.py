import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database.models import Resume, ResumeVersion

logger = logging.getLogger(__name__)


async def create_resume_version(
    db: AsyncSession,
    resume: Resume,
    content: Dict[str, Any],
    title: Optional[str] = None,
    change_summary: str = "Updated resume",
    ats_score: Optional[int] = None,
    target_jd: Optional[str] = None,
    ats_feedback: Optional[Dict[str, Any]] = None,
) -> ResumeVersion:
    """Create a new incremented ResumeVersion for the given resume."""
    # Find highest current version_number
    stmt = (
        select(ResumeVersion.version_number)
        .where(ResumeVersion.resume_id == resume.id)
        .order_by(desc(ResumeVersion.version_number))
        .limit(1)
    )
    result = await db.execute(stmt)
    latest_num = result.scalar_one_or_none() or 0
    next_version_num = latest_num + 1

    new_version = ResumeVersion(
        resume_id=resume.id,
        version_number=next_version_num,
        title=title or resume.title,
        content=content,
        change_summary=change_summary,
        ats_score=ats_score if ats_score is not None else resume.ats_score,
        target_jd=target_jd if target_jd is not None else resume.target_jd,
        ats_feedback=ats_feedback if ats_feedback is not None else resume.ats_feedback,
    )
    db.add(new_version)

    # Update parent resume active version counter and fields
    resume.version = next_version_num
    if title:
        resume.title = title
    resume.content = content
    if ats_score is not None:
        resume.ats_score = ats_score
    if target_jd is not None:
        resume.target_jd = target_jd
    if ats_feedback is not None:
        resume.ats_feedback = ats_feedback
    resume.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(new_version)
    await db.refresh(resume)

    logger.info(f"Created version {next_version_num} for resume {resume.id}")
    return new_version


async def list_versions_for_resume(
    db: AsyncSession,
    resume_id: str,
    user_id: str,
) -> List[ResumeVersion]:
    """List all saved versions for a specific resume, verified by user_id."""
    # Verify resume belongs to user
    res_stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    res_result = await db.execute(res_stmt)
    resume = res_result.scalar_one_or_none()
    if not resume:
        return []

    stmt = (
        select(ResumeVersion)
        .where(ResumeVersion.resume_id == resume_id)
        .order_by(desc(ResumeVersion.version_number))
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_version_by_id(
    db: AsyncSession,
    resume_id: str,
    version_id: str,
    user_id: str,
) -> Optional[ResumeVersion]:
    """Retrieve a single version record, ensuring ownership."""
    # Verify resume belongs to user
    res_stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    res_result = await db.execute(res_stmt)
    resume = res_result.scalar_one_or_none()
    if not resume:
        return None

    stmt = select(ResumeVersion).where(
        ResumeVersion.id == version_id,
        ResumeVersion.resume_id == resume_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def restore_resume_version(
    db: AsyncSession,
    resume_id: str,
    version_id: str,
    user_id: str,
) -> Optional[Resume]:
    """
    Restore an older version SAFELY by creating a brand-new version increment
    with the target version's content (e.g. Version 5 based on Version 2).
    This strictly prevents destruction of prior version history.
    """
    target_version = await get_version_by_id(db, resume_id, version_id, user_id)
    if not target_version:
        return None

    res_stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    res_result = await db.execute(res_stmt)
    resume = res_result.scalar_one_or_none()
    if not resume:
        return None

    # Create new version from target_version content
    summary = f"Restored from Version {target_version.version_number}"
    await create_resume_version(
        db=db,
        resume=resume,
        content=target_version.content or {},
        title=target_version.title or resume.title,
        change_summary=summary,
        ats_score=target_version.ats_score,
        target_jd=target_version.target_jd,
        ats_feedback=target_version.ats_feedback,
    )

    return resume


def compute_version_diff(
    v1_content: Dict[str, Any],
    v2_content: Dict[str, Any],
    v1_meta: Optional[Dict[str, Any]] = None,
    v2_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compute structured visual comparison between two versions.
    v1 is base (older), v2 is compared (newer).
    """
    v1_skills = set(v1_content.get("skills") or [])
    v2_skills = set(v2_content.get("skills") or [])

    skills_added = list(v2_skills - v1_skills)
    skills_removed = list(v1_skills - v2_skills)
    skills_unchanged = list(v1_skills & v2_skills)

    v1_summary = str(v1_content.get("summary") or "")
    v2_summary = str(v2_content.get("summary") or "")
    summary_changed = v1_summary.strip() != v2_summary.strip()

    # Experience diff stats
    v1_exp = v1_content.get("experience") or []
    v2_exp = v2_content.get("experience") or []

    v1_bullets_count = sum(len(e.get("achievements") or []) for e in v1_exp)
    v2_bullets_count = sum(len(e.get("achievements") or []) for e in v2_exp)

    # Score comparison
    v1_score = v1_meta.get("ats_score") if v1_meta else None
    v2_score = v2_meta.get("ats_score") if v2_meta else None
    score_diff = (v2_score - v1_score) if (v1_score is not None and v2_score is not None) else None

    return {
        "skills": {
            "added": skills_added,
            "removed": skills_removed,
            "unchanged": skills_unchanged,
        },
        "summary": {
            "changed": summary_changed,
            "base_text": v1_summary,
            "compared_text": v2_summary,
        },
        "experience": {
            "base_roles_count": len(v1_exp),
            "compared_roles_count": len(v2_exp),
            "base_bullets_count": v1_bullets_count,
            "compared_bullets_count": v2_bullets_count,
        },
        "ats_score": {
            "base_score": v1_score,
            "compared_score": v2_score,
            "score_diff": score_diff,
        },
    }
