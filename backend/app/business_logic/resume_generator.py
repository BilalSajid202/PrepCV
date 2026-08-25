import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from jinja2 import Environment, FileSystemLoader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.models import Resume, User
from app.schemas.resume import ResumeContentSchema

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
TEMPLATE_NAME = "resume_template.html"


# ---------------------------------------------------------------------------
# Dynamic spacing engine
# ---------------------------------------------------------------------------
SCALE_TIERS = {
    "spacious": dict(fs_base=11.5, fs_name=26, fs_section=12.5, line_height=1.5,
                      section_gap=22, item_gap=14, para_gap=6, page_margin=20),
    "normal":   dict(fs_base=10.5, fs_name=23, fs_section=11.5, line_height=1.35,
                      section_gap=16, item_gap=10, para_gap=4, page_margin=16),
    "compact":  dict(fs_base=9.5, fs_name=20, fs_section=10.5, line_height=1.22,
                      section_gap=11, item_gap=7, para_gap=3, page_margin=12),
    "dense":    dict(fs_base=8.8, fs_name=18, fs_section=10, line_height=1.15,
                      section_gap=8, item_gap=5, para_gap=2, page_margin=10),
}


def _text_len(value) -> int:
    return len(value) if isinstance(value, str) else 0


def estimate_content_score(data: dict) -> int:
    """Rough weighted count of 'how much stuff is on this resume'."""
    score = 0
    pi = data.get("personal_info") or {}
    score += _text_len(pi.get("summary"))

    for exp in data.get("experience") or []:
        score += 60  # fixed cost per role (title/company/dates lines)
        score += _text_len(exp.get("description"))
        for a in exp.get("achievements") or []:
            score += _text_len(a) + 10

    for edu in data.get("education") or []:
        score += 45
        score += _text_len(edu.get("description"))

    score += len(data.get("skills") or []) * 9

    for proj in data.get("projects") or []:
        score += 45
        score += _text_len(proj.get("description"))
        for a in proj.get("achievements") or []:
            score += _text_len(a) + 10
        score += len(proj.get("technologies") or []) * 6

    for cert in data.get("certifications") or []:
        score += 30

    return score


def pick_scale(data: dict) -> dict:
    score = estimate_content_score(data)
    if score < 500:
        tier = "spacious"
    elif score < 1100:
        tier = "normal"
    elif score < 1900:
        tier = "compact"
    else:
        tier = "dense"
    return SCALE_TIERS[tier]


def _safe_defaults(data: dict) -> dict:
    """Fill in missing top-level keys so the template never KeyErrors."""
    data = dict(data)
    data.setdefault("personal_info", {})
    data.setdefault("experience", [])
    data.setdefault("education", [])
    data.setdefault("skills", [])
    data.setdefault("projects", [])
    data.setdefault("certifications", [])
    return data


def render_resume_html(data: dict) -> str:
    """Render resume data into dynamic ATS-safe HTML using Jinja2 and content-scaled CSS."""
    data = _safe_defaults(data)
    scale = pick_scale(data)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template(TEMPLATE_NAME)

    return template.render(
        personal_info=data["personal_info"],
        experience=data["experience"],
        education=data["education"],
        skills=data["skills"],
        projects=data["projects"],
        certifications=data["certifications"],
        scale=scale,
        page_margin=scale["page_margin"],
    )


def render_resume_pdf(data: dict, output_path: str) -> None:
    """Render resume data to PDF using WeasyPrint (if installed)."""
    try:
        from weasyprint import HTML
        html_str = render_resume_html(data)
        HTML(string=html_str, base_url=str(TEMPLATE_DIR)).write_pdf(output_path)
    except ImportError:
        logger.warning("WeasyPrint is not installed. PDF generation via server unavailable.")
        raise RuntimeError("WeasyPrint is not installed on this server.")


def prepare_resume_render_data(profile_snapshot: Dict[str, Any], content: Dict[str, Any]) -> Dict[str, Any]:
    """Merge profile snapshot and edited resume content into standard structure for HTML rendering."""
    personal_info = dict(content.get("personal_info") or profile_snapshot.get("personal_info") or {})
    if not personal_info.get("summary") and content.get("summary"):
        personal_info["summary"] = content.get("summary")

    return {
        "personal_info": personal_info,
        "experience": content.get("experience") if content.get("experience") is not None else profile_snapshot.get("experience", []),
        "education": content.get("education") if content.get("education") is not None else profile_snapshot.get("education", []),
        "skills": content.get("skills") if content.get("skills") is not None else profile_snapshot.get("skills", []),
        "projects": content.get("projects") if content.get("projects") is not None else profile_snapshot.get("projects", []),
        "certifications": content.get("certifications") if content.get("certifications") is not None else profile_snapshot.get("certifications", []),
    }


# ---------------------------------------------------------------------------
# Direct Resume Content Generator (Pure Data -> Schema, No LLM Call Needed)
# ---------------------------------------------------------------------------
async def generate_ats_resume_content(profile_dict: Dict[str, Any], target_role: str = "", custom_instructions: str = "") -> ResumeContentSchema:
    """Generate ATS-optimized resume content directly from candidate profile data without extra LLM call."""
    personal_info = profile_dict.get("personal_info", {})
    name = personal_info.get("full_name", "Candidate")
    title = target_role or personal_info.get("professional_title", "Professional")
    existing_summary = personal_info.get("summary", "")

    summary = existing_summary if len(existing_summary) > 10 else f"Results-driven {title} with expertise in building scalable solutions and delivering high-impact results."

    experiences = []
    for exp in profile_dict.get("experience", []):
        achievements = exp.get("achievements", [])
        if not achievements and exp.get("description"):
            achievements = [exp["description"]]

        experiences.append({
            "company": exp.get("company", ""),
            "position": exp.get("position", ""),
            "location": exp.get("location", ""),
            "employment_type": exp.get("employment_type", ""),
            "start_date": exp.get("start_date", ""),
            "end_date": exp.get("end_date", "Present"),
            "is_current": exp.get("is_current", False),
            "description": exp.get("description", ""),
            "achievements": achievements or ["Executed core responsibilities and achieved team milestones."]
        })

    education = []
    for edu in profile_dict.get("education", []):
        education.append({
            "institution": edu.get("institution", ""),
            "degree": edu.get("degree", ""),
            "field_of_study": edu.get("field_of_study", ""),
            "start_date": edu.get("start_date", ""),
            "end_date": edu.get("end_date", "Present"),
            "is_current": edu.get("is_current", False),
            "gpa": edu.get("gpa", ""),
            "description": edu.get("description", "")
        })

    projects = []
    for proj in profile_dict.get("projects", []):
        achievements = proj.get("achievements", [])
        if not achievements and proj.get("description"):
            achievements = [proj["description"]]
        projects.append({
            "name": proj.get("name", ""),
            "technologies": proj.get("technologies", []),
            "description": proj.get("description", ""),
            "project_url": proj.get("project_url", ""),
            "github_url": proj.get("github_url", ""),
            "achievements": achievements or []
        })

    certifications = []
    for cert in profile_dict.get("certifications", []):
        certifications.append({
            "name": cert.get("name", ""),
            "issuing_organization": cert.get("issuing_organization", ""),
            "issue_date": cert.get("issue_date", ""),
            "expiration_date": cert.get("expiration_date", ""),
            "credential_id": cert.get("credential_id", ""),
            "credential_url": cert.get("credential_url", "")
        })

    return ResumeContentSchema(
        personal_info=personal_info,
        summary=summary,
        experience=experiences,
        education=education,
        skills=profile_dict.get("skills", ["Python", "FastAPI", "SQL", "Git"]),
        projects=projects,
        certifications=certifications
    )


async def improve_bullet_with_ai(section: str, original_text: str, instruction: str) -> Dict[str, str]:
    """Improve specific section text or bullet point using Gemini with input sanitization."""
    from app.integrations.gemini.client import improve_bullet_with_gemini
    return await improve_bullet_with_gemini(section=section, original_text=original_text, instruction=instruction)


async def save_generated_resume(db: AsyncSession, user: User, title: str, profile_snapshot: Dict[str, Any], content: ResumeContentSchema) -> Resume:
    """Save generated resume into DB."""
    resume = Resume(
        user_id=user.id,
        title=title,
        profile_snapshot=profile_snapshot,
        content=content.model_dump(),
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)
    return resume


async def get_user_resumes(db: AsyncSession, user_id: str) -> list[Resume]:
    """Fetch all resumes for a user."""
    stmt = select(Resume).where(Resume.user_id == user_id).order_by(Resume.updated_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_resume_by_id(db: AsyncSession, resume_id: str, user_id: str) -> Optional[Resume]:
    """Fetch single resume by ID for user."""
    stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
