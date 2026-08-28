import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.profile import get_user_profile
from app.business_logic.resume_generator import (
    generate_ats_resume_content,
    get_resume_by_id,
    get_user_resumes,
    improve_bullet_with_ai,
    prepare_resume_render_data,
    render_resume_html,
    render_resume_docx,
    save_generated_resume,
)
from app.business_logic.ats_scorer import score_resume_against_jd
from app.business_logic.resume_versioning import (
    create_resume_version,
    list_versions_for_resume,
    get_version_by_id,
    restore_resume_version,
    compute_version_diff,
)
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user
from app.schemas.resume import (
    AIImproveRequest,
    AIImproveResponse,
    ATSScoreRequest,
    ATSScoreResponse,
    CreateVersionRequest,
    ResumeContentSchema,
    ResumeGenerateRequest,
    ResumeResponse,
    ResumeUpdateRequest,
    ResumeVersionDetailResponse,
    ResumeVersionResponse,
    VersionCompareResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["ATS Resume Builder"])


# ===========================================================================
# STATIC ROUTES — must come BEFORE any /{resume_id} parameterized routes
# ===========================================================================

@router.post("/generate", response_model=ResumeResponse)
async def generate_resume(
    req: ResumeGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Generate ATS-optimized resume from candidate profile data."""
    profile_dict = {}
    if req.profile:
        profile_dict = req.profile.model_dump()
    else:
        profile = await get_user_profile(db, current_user.id)
        if profile:
            profile_dict = {
                "personal_info": profile.personal_info or {},
                "experience": profile.experience or [],
                "education": profile.education or [],
                "skills": profile.skills or [],
                "projects": profile.projects or [],
                "certifications": profile.certifications or [],
            }

    if not profile_dict or not profile_dict.get("personal_info", {}).get("full_name"):
        profile_dict["personal_info"] = {
            "full_name": current_user.full_name,
            "email": current_user.email,
        }

    generated_content = await generate_ats_resume_content(
        profile_dict=profile_dict,
        target_role=req.target_role or "",
        custom_instructions=req.custom_instructions or ""
    )

    resume_title = req.title or f"{current_user.full_name.split()[0]}'s Resume"
    saved_resume = await save_generated_resume(
        db=db,
        user=current_user,
        title=resume_title,
        profile_snapshot=profile_dict,
        content=generated_content,
    )

    return ResumeResponse(
        id=saved_resume.id,
        user_id=saved_resume.user_id,
        title=saved_resume.title,
        version=saved_resume.version or 1,
        ats_score=saved_resume.ats_score,
        target_jd=saved_resume.target_jd,
        profile_snapshot=saved_resume.profile_snapshot or {},
        content=saved_resume.content or {},
        created_at=saved_resume.created_at.isoformat(),
        updated_at=saved_resume.updated_at.isoformat(),
    )


@router.get("", response_model=List[ResumeResponse])
@router.get("/", response_model=List[ResumeResponse], include_in_schema=False)
async def list_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List all saved resumes for logged in user."""
    resumes = await get_user_resumes(db, current_user.id)
    return [
        ResumeResponse(
            id=r.id,
            user_id=r.user_id,
            title=r.title,
            version=r.version or 1,
            ats_score=r.ats_score,
            target_jd=r.target_jd,
            profile_snapshot=r.profile_snapshot or {},
            content=r.content or {},
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        )
        for r in resumes
    ]


@router.post("/ai-improve", response_model=AIImproveResponse)
async def ai_improve(
    req: AIImproveRequest,
    current_user: User = Depends(get_current_user),
):
    """AI action endpoint to refine section text or bullet point."""
    res = await improve_bullet_with_ai(
        section=req.section,
        original_text=req.text,
        instruction=req.instruction or "Improve for impact"
    )
    return AIImproveResponse(
        original_text=req.text,
        improved_text=res.get("improved_text", req.text),
        explanation=res.get("explanation", "Improved with action verbs and impact formatting.")
    )


@router.post("/ats-score-direct", response_model=ATSScoreResponse)
async def score_direct_content(
    req: ATSScoreRequest,
    current_user: User = Depends(get_current_user),
):
    """Score ad-hoc or preview resume content directly against a Job Description."""
    content_dict = req.content.model_dump() if req.content else {}
    score_data = await score_resume_against_jd(
        job_description=req.job_description,
        resume_content=content_dict
    )
    return ATSScoreResponse(
        overall_score=score_data.get("overall_score", 0),
        previous_score=None,
        score_change=None,
        score_tier=score_data.get("score_tier", "Evaluation Complete"),
        score_summary=score_data.get("score_summary", ""),
        keyword_stats=score_data.get("keyword_stats", {"matched_keywords_count": 0, "total_jd_keywords_count": 0}),
        breakdown=score_data.get("breakdown", {"keyword_match": 0, "skills_match": 0, "experience_match": 0, "education_match": 0}),
        missing_keywords=score_data.get("missing_keywords", []),
        matching_skills=score_data.get("matching_skills", []),
        recommendations=score_data.get("recommendations", [])
    )


@router.post("/render-preview")
async def render_preview_html(
    req: ResumeUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """Render dynamic HTML directly from submitted resume content without saving."""
    content_dict = req.content.model_dump() if req.content else {}
    render_data = prepare_resume_render_data(
        profile_snapshot={"personal_info": {"full_name": current_user.full_name, "email": current_user.email}},
        content=content_dict
    )
    html_content = render_resume_html(render_data)
    return {"html": html_content}


# ===========================================================================
# PARAMETERIZED ROUTES — /{resume_id} and sub-paths.
# ===========================================================================

@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Get single resume by ID."""
    resume = await get_resume_by_id(db, resume_id, current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found."
        )

    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        title=resume.title,
        version=resume.version or 1,
        ats_score=resume.ats_score,
        target_jd=resume.target_jd,
        profile_snapshot=resume.profile_snapshot or {},
        content=resume.content or {},
        created_at=resume.created_at.isoformat(),
        updated_at=resume.updated_at.isoformat(),
    )


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: str,
    req: ResumeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Update saved resume title or content."""
    resume = await get_resume_by_id(db, resume_id, current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found."
        )

    if req.title is not None:
        resume.title = req.title
    if req.content is not None:
        resume.content = req.content.model_dump()

    await db.commit()
    await db.refresh(resume)

    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        title=resume.title,
        version=resume.version or 1,
        ats_score=resume.ats_score,
        target_jd=resume.target_jd,
        profile_snapshot=resume.profile_snapshot or {},
        content=resume.content or {},
        created_at=resume.created_at.isoformat(),
        updated_at=resume.updated_at.isoformat(),
    )


@router.post("/{resume_id}/ats-score", response_model=ATSScoreResponse)
async def score_saved_resume(
    resume_id: str,
    req: ATSScoreRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Score saved resume against a Job Description.
    Calculates overall score, tracks previous score / score change, and saves score to DB.
    """
    resume = await get_resume_by_id(db, resume_id, current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found."
        )

    # Use content from request if provided (e.g. active unsaved edits), else use saved DB content
    content_dict = req.content.model_dump() if req.content else (resume.content or {})
    
    score_data = await score_resume_against_jd(
        job_description=req.job_description,
        resume_content=content_dict
    )

    new_score = score_data.get("overall_score", 0)
    prev_score = resume.ats_score
    score_change = (new_score - prev_score) if prev_score is not None else None

    # Update resume in DB with new score, JD, and feedback
    resume.ats_score = new_score
    resume.target_jd = req.job_description
    resume.ats_feedback = score_data
    await db.commit()
    await db.refresh(resume)

    return ATSScoreResponse(
        overall_score=new_score,
        previous_score=prev_score,
        score_change=score_change,
        score_tier=score_data.get("score_tier", "Evaluation Complete"),
        score_summary=score_data.get("score_summary", ""),
        keyword_stats=score_data.get("keyword_stats", {"matched_keywords_count": 0, "total_jd_keywords_count": 0}),
        breakdown=score_data.get("breakdown", {"keyword_match": 0, "skills_match": 0, "experience_match": 0, "education_match": 0}),
        missing_keywords=score_data.get("missing_keywords", []),
        matching_skills=score_data.get("matching_skills", []),
        recommendations=score_data.get("recommendations", [])
    )


# ===========================================================================
# VERSIONING ROUTES (FR-10, FR-12)
# ===========================================================================

@router.get("/{resume_id}/versions", response_model=List[ResumeVersionResponse])
async def get_resume_versions(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """List all version history records for a resume."""
    versions = await list_versions_for_resume(db, resume_id, current_user.id)
    return [
        ResumeVersionResponse(
            id=v.id,
            resume_id=v.resume_id,
            version_number=v.version_number,
            title=v.title,
            change_summary=v.change_summary or "Manual update",
            ats_score=v.ats_score,
            created_at=v.created_at.isoformat(),
        )
        for v in versions
    ]


@router.post("/{resume_id}/versions", response_model=ResumeVersionResponse)
async def create_version(
    resume_id: str,
    req: CreateVersionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Explicitly save current working draft as a new version."""
    resume = await get_resume_by_id(db, resume_id, current_user.id)
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")

    v = await create_resume_version(
        db=db,
        resume=resume,
        content=req.content.model_dump(),
        title=req.title or resume.title,
        change_summary=req.change_summary or f"Version {resume.version + 1}",
        ats_score=req.ats_score,
    )

    return ResumeVersionResponse(
        id=v.id,
        resume_id=v.resume_id,
        version_number=v.version_number,
        title=v.title,
        change_summary=v.change_summary,
        ats_score=v.ats_score,
        created_at=v.created_at.isoformat(),
    )


@router.get("/{resume_id}/versions/{version_id}", response_model=ResumeVersionDetailResponse)
async def get_resume_version_detail(
    resume_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve full detail and content of a specific resume version."""
    v = await get_version_by_id(db, resume_id, version_id, current_user.id)
    if not v:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found.")

    return ResumeVersionDetailResponse(
        id=v.id,
        resume_id=v.resume_id,
        version_number=v.version_number,
        title=v.title,
        change_summary=v.change_summary or "",
        content=v.content or {},
        ats_score=v.ats_score,
        target_jd=v.target_jd,
        created_at=v.created_at.isoformat(),
    )


@router.post("/{resume_id}/versions/{version_id}/restore", response_model=ResumeResponse)
async def restore_version(
    resume_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Restore an older version by creating a new incremented version.
    Preserves all previous versions in history.
    """
    updated_resume = await restore_resume_version(db, resume_id, version_id, current_user.id)
    if not updated_resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume or target version not found."
        )

    return ResumeResponse(
        id=updated_resume.id,
        user_id=updated_resume.user_id,
        title=updated_resume.title,
        version=updated_resume.version,
        ats_score=updated_resume.ats_score,
        target_jd=updated_resume.target_jd,
        profile_snapshot=updated_resume.profile_snapshot or {},
        content=updated_resume.content or {},
        created_at=updated_resume.created_at.isoformat(),
        updated_at=updated_resume.updated_at.isoformat(),
    )


@router.get("/{resume_id}/compare", response_model=VersionCompareResponse)
async def compare_versions(
    resume_id: str,
    base_version_id: str = Query(..., description="ID of base (older) version"),
    compared_version_id: str = Query(..., description="ID of compared (newer) version"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Compare two versions side-by-side."""
    v1 = await get_version_by_id(db, resume_id, base_version_id, current_user.id)
    v2 = await get_version_by_id(db, resume_id, compared_version_id, current_user.id)

    if not v1 or not v2:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or both versions not found.")

    v1_meta = {"version_number": v1.version_number, "title": v1.title, "ats_score": v1.ats_score, "created_at": v1.created_at.isoformat()}
    v2_meta = {"version_number": v2.version_number, "title": v2.title, "ats_score": v2.ats_score, "created_at": v2.created_at.isoformat()}

    diff = compute_version_diff(
        v1_content=v1.content or {},
        v2_content=v2.content or {},
        v1_meta=v1_meta,
        v2_meta=v2_meta,
    )

    return VersionCompareResponse(
        resume_id=resume_id,
        base_version=v1_meta,
        compared_version=v2_meta,
        diff=diff,
    )


@router.get("/{resume_id}/html", response_class=HTMLResponse)
async def get_resume_html(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Render dynamic ATS-optimized HTML for a specific resume without LLM calls."""
    resume = await get_resume_by_id(db, resume_id, current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume '{resume_id}' not found."
        )

    try:
        render_data = prepare_resume_render_data(
            profile_snapshot=resume.profile_snapshot or {},
            content=resume.content or {}
        )
        html_content = render_resume_html(render_data)
        return HTMLResponse(content=html_content)
    except Exception as e:
        logger.error(f"Rendering error for '{resume_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error rendering resume HTML: {str(e)}"
        )


@router.get("/{resume_id}/docx")
async def get_resume_docx(
    resume_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Generate and export ATS-safe Word (.docx) document for a resume without LLM calls."""
    resume = await get_resume_by_id(db, resume_id, current_user.id)
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resume '{resume_id}' not found."
        )

    try:
        render_data = prepare_resume_render_data(
            profile_snapshot=resume.profile_snapshot or {},
            content=resume.content or {}
        )
        docx_stream = render_resume_docx(render_data)
        safe_filename = "".join(c for c in (resume.title or "Resume") if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
        filename = f"{safe_filename}.docx"
        return StreamingResponse(
            docx_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        logger.error(f"Error generating DOCX for '{resume_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating DOCX resume: {str(e)}"
        )
