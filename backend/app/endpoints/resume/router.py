import logging
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.profile import get_user_profile
from app.business_logic.resume_generator import (
    generate_ats_resume_content,
    get_resume_by_id,
    get_user_resumes,
    improve_bullet_with_ai,
    prepare_resume_render_data,
    render_resume_html,
    save_generated_resume,
)
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user
from app.schemas.resume import (
    AIImproveRequest,
    AIImproveResponse,
    ResumeContentSchema,
    ResumeGenerateRequest,
    ResumeResponse,
    ResumeUpdateRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["ATS Resume Builder"])


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
        # Default minimal fallback snapshot
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
            profile_snapshot=r.profile_snapshot or {},
            content=r.content or {},
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
        )
        for r in resumes
    ]


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
        profile_snapshot=resume.profile_snapshot or {},
        content=resume.content or {},
        created_at=resume.created_at.isoformat(),
        updated_at=resume.updated_at.isoformat(),
    )


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
            detail="Resume not found."
        )

    render_data = prepare_resume_render_data(
        profile_snapshot=resume.profile_snapshot or {},
        content=resume.content or {}
    )
    html_content = render_resume_html(render_data)
    return HTMLResponse(content=html_content)


@router.post("/render-preview")
async def render_preview_html(
    req: ResumeUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """Render dynamic HTML directly from submitted resume content without saving or LLM calls."""
    content_dict = req.content.model_dump() if req.content else {}
    render_data = prepare_resume_render_data(
        profile_snapshot={"personal_info": {"full_name": current_user.full_name, "email": current_user.email}},
        content=content_dict
    )
    html_content = render_resume_html(render_data)
    return {"html": html_content}
