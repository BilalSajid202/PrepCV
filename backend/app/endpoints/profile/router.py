import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.cv_extractor import extract_raw_text_from_file, parse_cv_text_with_llm
from app.business_logic.profile import get_user_profile, save_or_update_profile
from app.integrations.huggingface.client import format_cv_with_hf
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user
from app.endpoints.auth.feature_guard import require_feature
from app.schemas.profile import ProfileResponse, ProfileSchema

# Inline request model for the format-with-ai endpoint
from pydantic import BaseModel, Field
from typing import Optional


class FormatWithAIRequest(BaseModel):
    profile: ProfileSchema
    job_title: str = Field(..., min_length=1, max_length=150)

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


@router.post("/upload-cv", response_model=ProfileResponse, dependencies=[Depends(require_feature("cv_upload"))])
async def upload_cv(
    file: UploadFile = File(...),
    job_title: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Upload CV/Resume (PDF or DOCX), extract text, format with Hugging Face Qwen LLM using
    strict input sanitization, forced JSON output schema, and ProfileSchema validation."""
    logger.info(f"==> [CV Upload] Received upload request from user '{current_user.id}' ({current_user.email})")
    logger.info(f"==> [CV Upload] Filename: '{file.filename}', Content-Type: '{file.content_type}', Target Job Title: '{job_title}'")

    if not file.filename:
        logger.warning("==> [CV Upload] Rejected: No filename provided.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file uploaded. Please select a valid PDF (.pdf) or Word (.docx) document."
        )

    lower_name = file.filename.lower()
    if not (lower_name.endswith(".pdf") or lower_name.endswith(".docx")):
        logger.warning(f"==> [CV Upload] Rejected unsupported extension: {file.filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only PDF (.pdf) and Word (.docx) documents are allowed."
        )

    file_bytes = await file.read()
    file_size_kb = len(file_bytes) / 1024
    logger.info(f"==> [CV Upload] Read {len(file_bytes)} bytes ({file_size_kb:.1f} KB) for '{file.filename}'")

    if len(file_bytes) == 0:
        logger.warning("==> [CV Upload] Rejected: File is empty (0 bytes).")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes). Please upload a valid document."
        )

    if len(file_bytes) > 10 * 1024 * 1024:  # 10MB limit
        logger.warning(f"==> [CV Upload] Rejected: File size ({file_size_kb:.1f} KB) exceeds 10MB limit.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10 MB maximum limit."
        )

    try:
        logger.info(f"==> [CV Upload] Extracting text from '{file.filename}'...")
        raw_text = extract_raw_text_from_file(file_bytes, file.filename)
        logger.info(f"==> [CV Upload] Extracted {len(raw_text)} characters of text. Sample: {raw_text[:200]!r}")
    except Exception as e:
        logger.error(f"==> [CV Upload] Extraction failure: {e}", exc_info=True)
        raise

    try:
        logger.info(f"==> [CV Upload] Sending text to LLM parser for role: '{job_title}'...")
        parsed_profile = await parse_cv_text_with_llm(raw_text, job_title=job_title)
        logger.info(f"==> [CV Upload] Parsing completed. Found: {len(parsed_profile.get('experience', []))} roles, {len(parsed_profile.get('education', []))} education items, {len(parsed_profile.get('skills', []))} skills.")
    except Exception as e:
        logger.error(f"==> [CV Upload] LLM parsing error: {e}", exc_info=True)
        raise

    # Ensure personal_info defaults to user full name and email if missing
    if "personal_info" in parsed_profile:
        if not parsed_profile["personal_info"].get("full_name"):
            parsed_profile["personal_info"]["full_name"] = current_user.full_name
        if not parsed_profile["personal_info"].get("email"):
            parsed_profile["personal_info"]["email"] = current_user.email
        if job_title and not parsed_profile["personal_info"].get("professional_title"):
            parsed_profile["personal_info"]["professional_title"] = job_title

    # Auto-save the formatted profile to the database
    try:
        logger.info(f"==> [CV Upload] Saving profile to database for user '{current_user.id}'...")
        profile_schema = ProfileSchema(**parsed_profile)
        saved_profile = await save_or_update_profile(db, current_user, profile_schema)
        logger.info(f"==> [CV Upload] Profile successfully saved to database with ID '{saved_profile.id}'.")
    except Exception as e:
        logger.error(f"==> [CV Upload] Database save error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save parsed profile to database: {str(e)}"
        )

    return ProfileResponse(
        id=saved_profile.id,
        user_id=saved_profile.user_id,
        personal_info=saved_profile.personal_info or {},
        experience=saved_profile.experience or [],
        education=saved_profile.education or [],
        skills=saved_profile.skills or [],
        projects=saved_profile.projects or [],
        certifications=saved_profile.certifications or [],
        created_at=saved_profile.created_at.isoformat(),
        updated_at=saved_profile.updated_at.isoformat(),
    )


@router.post("/format-with-ai", response_model=ProfileResponse)
async def format_profile_with_ai(
    req: FormatWithAIRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """Format manually-entered profile data using Hugging Face Qwen LLM.
    Enhances descriptions, populates missing fields, and tailors content
    for the specified job title. Saves the formatted result to the database."""
    raw_profile = req.profile.model_dump()

    # Send through Hugging Face Qwen with input sanitization and schema validation
    formatted_profile = await format_cv_with_hf(raw_profile, req.job_title)

    # Ensure user identity fields are preserved
    if "personal_info" in formatted_profile:
        if not formatted_profile["personal_info"].get("full_name"):
            formatted_profile["personal_info"]["full_name"] = current_user.full_name
        if not formatted_profile["personal_info"].get("email"):
            formatted_profile["personal_info"]["email"] = current_user.email

    # Save the formatted profile to the database
    profile_schema = ProfileSchema(**formatted_profile)
    saved_profile = await save_or_update_profile(db, current_user, profile_schema)

    return ProfileResponse(
        id=saved_profile.id,
        user_id=saved_profile.user_id,
        personal_info=saved_profile.personal_info or {},
        experience=saved_profile.experience or [],
        education=saved_profile.education or [],
        skills=saved_profile.skills or [],
        projects=saved_profile.projects or [],
        certifications=saved_profile.certifications or [],
        created_at=saved_profile.created_at.isoformat(),
        updated_at=saved_profile.updated_at.isoformat(),
    )
