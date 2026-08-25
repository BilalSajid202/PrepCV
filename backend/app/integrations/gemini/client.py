import json
import logging
import re
from typing import Dict, Any, Optional

import httpx

from app.core.config import get_settings
from app.schemas.profile import ProfileSchema

logger = logging.getLogger(__name__)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
PRIMARY_MODEL = "gemini-2.0-flash"
FALLBACK_MODEL = "gemini-1.5-flash"


def _sanitize_string(val: Any, max_len: int = 2000) -> str:
    """Sanitize user string: strip trailing/leading whitespace and truncate excessive lengths."""
    if not isinstance(val, str):
        return ""
    # Strip null bytes and non-printable control characters except standard newlines/tabs
    clean = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", val).strip()
    return clean[:max_len]


def _sanitize_job_title(job_title: str) -> str:
    """Sanitize target job title before passing to model context."""
    return _sanitize_string(job_title, max_len=150) or "Industry Professional"


def _sanitize_profile_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize input dictionary before sending to LLM."""
    if not isinstance(raw, dict):
        return {}

    pi = raw.get("personal_info") or {}
    sanitized_pi = {
        "full_name": _sanitize_string(pi.get("full_name"), 150),
        "professional_title": _sanitize_string(pi.get("professional_title"), 150),
        "email": _sanitize_string(pi.get("email"), 150),
        "phone": _sanitize_string(pi.get("phone"), 50),
        "location": _sanitize_string(pi.get("location"), 150),
        "linkedin_url": _sanitize_string(pi.get("linkedin_url"), 255),
        "github_url": _sanitize_string(pi.get("github_url"), 255),
        "portfolio_url": _sanitize_string(pi.get("portfolio_url"), 255),
        "summary": _sanitize_string(pi.get("summary"), 2000),
    }

    sanitized_exp = []
    for exp in (raw.get("experience") or [])[:15]:  # limit to max 15 roles
        if isinstance(exp, dict):
            achievements = [_sanitize_string(a, 500) for a in (exp.get("achievements") or [])[:10] if a]
            sanitized_exp.append({
                "company": _sanitize_string(exp.get("company"), 150),
                "position": _sanitize_string(exp.get("position"), 150),
                "location": _sanitize_string(exp.get("location"), 150),
                "employment_type": _sanitize_string(exp.get("employment_type"), 50),
                "start_date": _sanitize_string(exp.get("start_date"), 50),
                "end_date": _sanitize_string(exp.get("end_date"), 50),
                "is_current": bool(exp.get("is_current", False)),
                "description": _sanitize_string(exp.get("description"), 2000),
                "achievements": achievements,
            })

    sanitized_edu = []
    for edu in (raw.get("education") or [])[:10]:
        if isinstance(edu, dict):
            sanitized_edu.append({
                "institution": _sanitize_string(edu.get("institution"), 150),
                "degree": _sanitize_string(edu.get("degree"), 150),
                "field_of_study": _sanitize_string(edu.get("field_of_study"), 150),
                "start_date": _sanitize_string(edu.get("start_date"), 50),
                "end_date": _sanitize_string(edu.get("end_date"), 50),
                "is_current": bool(edu.get("is_current", False)),
                "gpa": _sanitize_string(edu.get("gpa"), 20),
                "description": _sanitize_string(edu.get("description"), 1000),
            })

    sanitized_skills = [_sanitize_string(s, 60) for s in (raw.get("skills") or [])[:50] if s]

    sanitized_projects = []
    for proj in (raw.get("projects") or [])[:15]:
        if isinstance(proj, dict):
            techs = [_sanitize_string(t, 60) for t in (proj.get("technologies") or [])[:20] if t]
            achievements = [_sanitize_string(a, 500) for a in (proj.get("achievements") or [])[:10] if a]
            sanitized_projects.append({
                "name": _sanitize_string(proj.get("name"), 150),
                "description": _sanitize_string(proj.get("description"), 2000),
                "technologies": techs,
                "project_url": _sanitize_string(proj.get("project_url"), 255),
                "github_url": _sanitize_string(proj.get("github_url"), 255),
                "achievements": achievements,
            })

    sanitized_certs = []
    for cert in (raw.get("certifications") or [])[:15]:
        if isinstance(cert, dict):
            sanitized_certs.append({
                "name": _sanitize_string(cert.get("name"), 150),
                "issuing_organization": _sanitize_string(cert.get("issuing_organization"), 150),
                "issue_date": _sanitize_string(cert.get("issue_date"), 50),
                "expiration_date": _sanitize_string(cert.get("expiration_date"), 50),
                "credential_id": _sanitize_string(cert.get("credential_id"), 100),
                "credential_url": _sanitize_string(cert.get("credential_url"), 255),
            })

    result = {
        "personal_info": sanitized_pi,
        "experience": sanitized_exp,
        "education": sanitized_edu,
        "skills": sanitized_skills,
        "projects": sanitized_projects,
        "certifications": sanitized_certs,
    }

    if "_raw_text" in raw:
        result["_raw_text"] = _sanitize_string(raw["_raw_text"], 8000)

    return result


async def _call_gemini_json_api(
    system_instruction: str,
    user_payload: str,
    api_key: str,
    model_name: str = PRIMARY_MODEL,
    retry_count: int = 1,
) -> Optional[str]:
    """
    Call Google Gemini API forcing JSON response.
    Logs the raw response for debugging and retries once if needed.
    """
    url = f"{GEMINI_API_BASE}/{model_name}:generateContent?key={api_key}"

    payload = {
        "system_instruction": {
            "parts": [{"text": system_instruction}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_payload}]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    for attempt in range(retry_count + 1):
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(url, json=payload)

                if resp.status_code != 200:
                    logger.warning(
                        f"Gemini API ({model_name}) attempt {attempt + 1} returned status {resp.status_code}: {resp.text[:400]}"
                    )
                    if attempt < retry_count:
                        continue
                    return None

                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    logger.warning(f"Gemini API returned no candidates on attempt {attempt + 1}.")
                    if attempt < retry_count:
                        continue
                    return None

                raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                
                # Rule 3: Store/log raw response for debugging
                logger.info(
                    f"Gemini raw response received ({len(raw_text)} chars, attempt {attempt + 1}): {raw_text[:300]}..."
                )
                return raw_text

        except httpx.TimeoutException:
            logger.warning(f"Gemini API timeout on attempt {attempt + 1}.")
            if attempt < retry_count:
                continue
        except Exception as e:
            logger.error(f"Gemini API request error on attempt {attempt + 1}: {e}")
            if attempt < retry_count:
                continue

    return None


async def format_cv_with_gemini(
    raw_profile: Dict[str, Any],
    job_title: str,
) -> Dict[str, Any]:
    """
    Format and enhance CV / profile data using Google Gemini Flash.
    Strictly follows:
      1. Sanitize user data before building prompts.
      2. Force structured JSON schema output & validate against ProfileSchema before returning.
      3. Log raw model responses for easy debugging.
    """
    settings = get_settings()
    api_key = settings.gemini_api_key

    # Pre-sanitize inputs (Rule 1)
    clean_job_title = _sanitize_job_title(job_title)
    clean_profile = _sanitize_profile_dict(raw_profile)

    if not api_key:
        logger.warning("GEMINI_API_KEY is not set – returning sanitized profile without AI formatting.")
        clean_profile.pop("_raw_text", None)
        return clean_profile

    system_instruction = f"""You are an elite career coach and ATS resume strategist.
Your task is to take candidate data and produce an ATS-optimized, high-impact candidate profile JSON object tailored for the target role: "{clean_job_title}".

Guidelines:
1. Target Role: "{clean_job_title}".
2. Set "personal_info.professional_title" to "{clean_job_title}" if appropriate.
3. Write a compelling, concise 3-4 sentence professional summary in "personal_info.summary" highlighting strengths for this target role.
4. For all experience items, rewrite achievement bullets to begin with powerful action verbs (e.g. Engineered, Spearheaded, Optimized, Delivered) and include quantifiable metrics where plausible.
5. Cleanly standardize skills, education, and project descriptions.
6. Preserve all genuine user facts (names, companies, degrees, dates).
7. Return ONLY valid JSON matching this schema:
{{
  "personal_info": {{
    "full_name": "string",
    "professional_title": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin_url": "string",
    "github_url": "string",
    "portfolio_url": "string",
    "summary": "string"
  }},
  "experience": [
    {{
      "company": "string",
      "position": "string",
      "location": "string",
      "employment_type": "string",
      "start_date": "string",
      "end_date": "string",
      "is_current": false,
      "description": "string",
      "achievements": ["string"]
    }}
  ],
  "education": [
    {{
      "institution": "string",
      "degree": "string",
      "field_of_study": "string",
      "start_date": "string",
      "end_date": "string",
      "is_current": false,
      "gpa": "string",
      "description": "string"
    }}
  ],
  "skills": ["string"],
  "projects": [
    {{
      "name": "string",
      "description": "string",
      "technologies": ["string"],
      "project_url": "string",
      "github_url": "string",
      "achievements": ["string"]
    }}
  ],
  "certifications": [
    {{
      "name": "string",
      "issuing_organization": "string",
      "issue_date": "string",
      "expiration_date": "string",
      "credential_id": "string",
      "credential_url": "string"
    }}
  ]
}}"""

    # Prepare user message containing only candidate data (Rule 1)
    user_payload = f"Candidate Profile Data:\n{json.dumps(clean_profile, indent=2)}"

    # Call Gemini API with JSON output mode (Rule 2)
    raw_response = await _call_gemini_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        api_key=api_key,
        model_name=PRIMARY_MODEL,
        retry_count=1,
    )

    if not raw_response:
        logger.warning("Gemini primary model failed, attempting fallback model...")
        raw_response = await _call_gemini_json_api(
            system_instruction=system_instruction,
            user_payload=user_payload,
            api_key=api_key,
            model_name=FALLBACK_MODEL,
            retry_count=1,
        )

    if raw_response:
        try:
            # Strip potential code fences if any
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
            parsed = json.loads(clean_json_str)

            # Rule 2: Validate against Pydantic schema before returning for Postgres write
            validated_schema = ProfileSchema.model_validate(parsed)
            logger.info("Successfully validated formatted profile with Pydantic ProfileSchema.")
            return validated_schema.model_dump()

        except Exception as err:
            # Rule 3: Log parse/validation failure with the raw response for debugging
            logger.error(f"Failed to parse/validate Gemini response: {err}. Raw response was: {raw_response[:500]}")

    # Fallback to sanitized raw profile on any failure
    logger.warning("Falling back to pre-sanitized input profile.")
    clean_profile.pop("_raw_text", None)
    return clean_profile


async def improve_bullet_with_gemini(section: str, original_text: str, instruction: str) -> Dict[str, str]:
    """Improve specific section text or bullet point using Gemini with input sanitization."""
    settings = get_settings()
    api_key = settings.gemini_api_key

    clean_section = _sanitize_string(section, 50)
    clean_text = _sanitize_string(original_text, 2000)
    clean_inst = _sanitize_string(instruction, 300) or "Improve for impact and ATS keyword strength"

    if not clean_text:
        return {"improved_text": "", "explanation": "No text provided."}

    if not api_key:
        words = clean_text.split()
        improved = clean_text
        if words and not words[0].endswith("ed"):
            improved = f"Spearheaded and executed: {clean_text}"
        return {
            "improved_text": improved,
            "explanation": "Action-verb formatting applied (offline mode)."
        }

    system_instruction = """You are a professional resume bullet point optimizer.
Rewrite the provided resume text to be punchy, ATS-optimized, action-oriented, and impactful.
Return ONLY a JSON object with keys:
"improved_text": "the improved bullet/text",
"explanation": "brief 1-sentence note of what changed"
"""

    user_payload = json.dumps({
        "section": clean_section,
        "original_text": clean_text,
        "instruction": clean_inst,
    })

    raw_response = await _call_gemini_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        api_key=api_key,
        model_name=PRIMARY_MODEL,
        retry_count=1,
    )

    if raw_response:
        try:
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
            parsed = json.loads(clean_json_str)
            if "improved_text" in parsed:
                return {
                    "improved_text": _sanitize_string(parsed.get("improved_text"), 2000),
                    "explanation": _sanitize_string(parsed.get("explanation"), 500),
                }
        except Exception as e:
            logger.warning(f"Error parsing bullet improvement JSON: {e}")

    # Heuristic fallback
    return {
        "improved_text": f"Spearheaded and optimized: {clean_text}" if not clean_text.lower().startswith("spearheaded") else clean_text,
        "explanation": "Refined with action-oriented structure."
    }
