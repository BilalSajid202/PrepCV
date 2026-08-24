import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.cv_extractor import extract_raw_text_from_file, parse_cv_text_with_llm
from app.business_logic.profile import get_user_profile, save_or_update_profile
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user
from app.schemas.profile import ProfileResponse, ProfileSchema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Profile Intake"])


@router.get("", response_model=ProfileResponse)
@router.get("/", response_model=ProfileResponse, include_in_schema=False)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Retrieve current candidate profile."""
    profile = await get_user_profile(db, current_user.id)
    if not profile:
        # Return empty default profile structure pre-filled with user's registered name and email
        return ProfileResponse(
            id="",
            user_id=current_user.id,
            personal_info={
                "full_name": current_user.full_name or "",
                "professional_title": "",
                "email": current_user.email or "",
                "phone": "",
                "location": "",
                "linkedin_url": "",
                "github_url": "",
                "portfolio_url": "",
                "summary": "",
            },
            experience=[],
            education=[],
            skills=[],
            projects=[],
            certifications=[],
            created_at="",
            updated_at="",
        )

    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        personal_info=profile.personal_info or {},
        experience=profile.experience or [],
        education=profile.education or [],
        skills=profile.skills or [],
        projects=profile.projects or [],
        certifications=profile.certifications or [],
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )


@router.put("", response_model=ProfileResponse)
@router.put("/", response_model=ProfileResponse, include_in_schema=False)
async def update_profile(
    profile_in: ProfileSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Save or update candidate profile."""
    profile = await save_or_update_profile(db, current_user, profile_in)
    return ProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        personal_info=profile.personal_info or {},
        experience=profile.experience or [],
        education=profile.education or [],
        skills=profile.skills or [],
        projects=profile.projects or [],
        certifications=profile.certifications or [],
        created_at=profile.created_at.isoformat(),
        updated_at=profile.updated_at.isoformat(),
    )


@router.post("/upload-cv")
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload CV/Resume (PDF or DOCX), extract text, and parse into structured profile format."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file uploaded. Please select a valid PDF (.pdf) or Word (.docx) document."
        )

    lower_name = file.filename.lower()
    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only PDF (.pdf) and Word (.docx) documents are allowed."
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes). Please upload a valid document."
        )

    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10 MB maximum limit."
        )

    raw_text = extract_raw_text_from_file(file_bytes, file.filename)
    parsed_profile = await parse_cv_text_with_llm(raw_text)

    # Ensure personal_info defaults to user full name and email if missing
    if "personal_info" in parsed_profile:
        if not parsed_profile["personal_info"].get("full_name"):
            parsed_profile["personal_info"]["full_name"] = current_user.full_name
        if not parsed_profile["personal_info"].get("email"):
            parsed_profile["personal_info"]["email"] = current_user.email

    return {
        "status": "success",
        "filename": file.filename,
        "extracted_profile": parsed_profile
    }
