import json
import logging
import re
from typing import Dict, Any, Optional

httpx_client = None
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.database.models import Resume, User
from app.schemas.profile import ProfileSchema
from app.schemas.resume import ResumeContentSchema, ResumeGenerateRequest

logger = logging.getLogger(__name__)


async def generate_ats_resume_content(profile_dict: Dict[str, Any], target_role: str = "", custom_instructions: str = "") -> ResumeContentSchema:
    """Generate ATS-optimized resume content using Gemini Flash 2.0 with fallback under 15 seconds."""
    settings = get_settings()
    api_key = settings.gemini_api_key

    system_prompt = f"""You are a professional ATS resume strategist.
Your task is to take candidate profile data and convert it into an ATS-optimized, high-impact resume.
Target Role: {target_role or 'General / Industry Standard'}
Custom Instructions: {custom_instructions or 'Emphasize strong action verbs, quantifiable achievements, and ATS keyword optimization.'}

Rules:
1. Generate an impactful, concise Professional Summary (3-4 sentences).
2. For each work experience and project, polish the achievement bullets so they start with strong action verbs (e.g., 'Engineered', 'Optimized', 'Deployed', 'Spearheaded') and emphasize measurable metrics where applicable.
3. Organize skills cleanly into relevant tech/professional skills.
4. Ensure standard section layout structure.

Return ONLY valid JSON matching this schema:
{{
  "summary": "Polished high-impact professional summary...",
  "experience": [
    {{
      "company": "Company",
      "position": "Title",
      "location": "Location",
      "start_date": "Date",
      "end_date": "Date",
      "achievements": ["Action-oriented bullet 1", "Action-oriented bullet 2"]
    }}
  ],
  "education": [
    {{
      "institution": "School",
      "degree": "Degree",
      "field_of_study": "Field",
      "start_date": "Date",
      "end_date": "Date",
      "gpa": "GPA if any"
    }}
  ],
  "skills": ["Skill 1", "Skill 2"],
  "projects": [
    {{
      "name": "Project Name",
      "technologies": ["Tech 1"],
      "description": "Short overview",
      "achievements": ["Action bullet 1"]
    }}
  ],
  "certifications": [
    {{
      "name": "Cert Name",
      "issuing_organization": "Issuer",
      "issue_date": "Date"
    }}
  ]
}}"""

    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": system_prompt},
                            {"text": f"Candidate Profile JSON:\n{json.dumps(profile_dict, indent=2)}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json"
                }
            }
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    res_data = resp.json()
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        content_text = candidates[0]["content"]["parts"][0]["text"]
                        clean_json_str = re.sub(r"^```json\s*|\s*```$", "", content_text.strip(), flags=re.MULTILINE)
                        parsed = json.loads(clean_json_str)
                        return ResumeContentSchema(**parsed)
        except Exception as e:
            logger.warning(f"Gemini Flash LLM resume generation error, using rule-based generator: {e}")

    # Fallback rule-based resume generator if LLM call is unavailable
    return fallback_resume_generator(profile_dict)


def fallback_resume_generator(profile_dict: Dict[str, Any]) -> ResumeContentSchema:
    """Fallback generator to construct optimized ATS resume content directly from profile JSON."""
    personal_info = profile_dict.get("personal_info", {})
    name = personal_info.get("full_name", "Candidate")
    title = personal_info.get("professional_title", "Professional")
    existing_summary = personal_info.get("summary", "")

    summary = existing_summary if len(existing_summary) > 20 else f"Results-driven {title} with expertise in building scalable systems, optimizing technical solutions, and collaborating across cross-functional teams to deliver high-impact software applications."

    experiences = []
    for exp in profile_dict.get("experience", []):
        achievements = exp.get("achievements", [])
        if not achievements and exp.get("description"):
            achievements = [exp["description"]]
        
        # Add action verbs if not present
        polished_bullets = []
        for bullet in achievements:
            if not any(bullet.strip().startswith(verb) for verb in ["Built", "Developed", "Engineered", "Created", "Optimized", "Spearheaded", "Led", "Implemented", "Designed"]):
                bullet = f"Architected and implemented {bullet[0].lower() if bullet else ''}{bullet[1:] if len(bullet) > 1 else ''}"
            polished_bullets.append(bullet)

        experiences.append({
            "company": exp.get("company", ""),
            "position": exp.get("position", ""),
            "location": exp.get("location", ""),
            "start_date": exp.get("start_date", ""),
            "end_date": exp.get("end_date", "Present"),
            "achievements": polished_bullets or ["Spearheaded core software feature development using industry best practices."]
        })

    education = []
    for edu in profile_dict.get("education", []):
        education.append({
            "institution": edu.get("institution", ""),
            "degree": edu.get("degree", ""),
            "field_of_study": edu.get("field_of_study", ""),
            "start_date": edu.get("start_date", ""),
            "end_date": edu.get("end_date", ""),
            "gpa": edu.get("gpa", "")
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
            "achievements": achievements or ["Developed key software module."]
        })

    certifications = []
    for cert in profile_dict.get("certifications", []):
        certifications.append({
            "name": cert.get("name", ""),
            "issuing_organization": cert.get("issuing_organization", ""),
            "issue_date": cert.get("issue_date", "")
        })

    return ResumeContentSchema(
        summary=summary,
        experience=experiences,
        education=education,
        skills=profile_dict.get("skills", ["Python", "FastAPI", "SQL", "Git"]),
        projects=projects,
        certifications=certifications
    )


async def improve_bullet_with_ai(section: str, original_text: str, instruction: str) -> Dict[str, str]:
    """Improve specific section text or bullet point using AI."""
    settings = get_settings()
    api_key = settings.gemini_api_key

    prompt = f"""You are a professional resume editor.
Section: {section}
Original text: "{original_text}"
Instruction: {instruction}

Rewrite the text to be punchy, ATS-optimized, action-oriented, and impactful. Return ONLY a JSON object with keys:
"improved_text": "the improved bullet/text",
"explanation": "brief 1-sentence note of what changed"
"""

    if api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    res_data = resp.json()
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        content_text = candidates[0]["content"]["parts"][0]["text"]
                        clean_json_str = re.sub(r"^```json\s*|\s*```$", "", content_text.strip(), flags=re.MULTILINE)
                        return json.loads(clean_json_str)
        except Exception as e:
            logger.warning(f"AI bullet improve error: {e}")

    # Fallback improvement
    words = original_text.strip().split()
    improved = original_text
    if words and not words[0].endswith("ed"):
        improved = f"Spearheaded and executed: {original_text}"
    return {
        "improved_text": improved,
        "explanation": "Enhanced with strong action verbs and professional formatting."
    }


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
