import asyncio
import json
import logging
import re
import time
from typing import Dict, Any, List, Optional

import httpx

from app.core.config import get_settings
from app.schemas.profile import ProfileSchema

logger = logging.getLogger(__name__)

# Default model (can be overridden via HF_MODEL in .env)
DEFAULT_HF_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct"
DEFAULT_HF_API_URL = "https://router.huggingface.co/v1/chat/completions"


class HFKeyManager:
    """
    Thread-safe & async-friendly rotating API Key Manager for Hugging Face.
    Rotates through configured keys, automatically tracking rate limits (429/402/quota)
    and failing over to the next available key.
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._keys: List[str] = []
        self._current_index: int = 0
        self._key_cooldowns: Dict[str, float] = {}  # key -> timestamp until cooldown expires
        self._reload_keys()

    def _reload_keys(self) -> None:
        settings = get_settings()
        self._keys = settings.get_hf_api_keys()
        if not self._keys and settings.hf_api_key:
            self._keys = [settings.hf_api_key]

    @property
    def key_count(self) -> int:
        self._reload_keys()
        return len(self._keys)

    def has_keys(self) -> bool:
        return self.key_count > 0

    async def get_active_keys(self) -> List[str]:
        """Return all keys currently not in cooldown."""
        self._reload_keys()
        now = time.time()
        active = [k for k in self._keys if self._key_cooldowns.get(k, 0) <= now]
        # If all keys are in cooldown, reset all to allow immediate retry
        if not active and self._keys:
            logger.warning("All Hugging Face API keys are currently in cooldown; resetting cooldowns.")
            self._key_cooldowns.clear()
            return list(self._keys)
        return active

    async def get_next_key(self) -> Optional[str]:
        """Rotate to and return the next active key."""
        async with self._lock:
            active_keys = await self.get_active_keys()
            if not active_keys:
                return None

            self._current_index = (self._current_index + 1) % len(active_keys)
            selected = active_keys[self._current_index]
            return selected

    def report_rate_limit(self, key: str, cooldown_seconds: int = 60) -> None:
        """Mark a key as rate-limited / tier-exhausted temporarily."""
        mask = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "key"
        self._key_cooldowns[key] = time.time() + cooldown_seconds
        logger.warning(
            f"Hugging Face key [{mask}] reached rate-limit/quota. Placed on {cooldown_seconds}s cooldown. "
            f"Active keys remaining: {len([k for k, exp in self._key_cooldowns.items() if exp <= time.time()])}/{len(self._keys)}"
        )

    def report_success(self, key: str) -> None:
        """Clear any cooldown on successful call."""
        if key in self._key_cooldowns:
            del self._key_cooldowns[key]


# Global key manager singleton
_key_manager = HFKeyManager()


def get_hf_key_manager() -> HFKeyManager:
    return _key_manager


def _sanitize_string(val: Any, max_len: int = 2000) -> str:
    """Sanitize user string: strip trailing/leading whitespace and truncate excessive lengths."""
    if not isinstance(val, str):
        return ""
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
    for exp in (raw.get("experience") or [])[:15]:
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


async def _call_hf_json_api(
    system_instruction: str,
    user_payload: str,
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    retry_count: int = 1,
) -> Optional[str]:
    """
    Call Hugging Face Router chat completions API forcing JSON output.
    Uses rotating API keys with automatic failover when a key hits rate limits or quota tiers.
    """
    settings = get_settings()
    model = model_name or settings.hf_model or DEFAULT_HF_MODEL
    api_url = settings.hf_api_url or DEFAULT_HF_API_URL
    km = get_hf_key_manager()

    messages = []
    if system_instruction:
        messages.append({
            "role": "system",
            "content": f"{system_instruction}\n\nIMPORTANT: Return ONLY raw, valid JSON. Do not include markdown code block backticks, explanations, or prose."
        })
    messages.append({"role": "user", "content": user_payload})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 4096,
    }

    total_keys = km.key_count
    max_attempts = max(total_keys, 1) * (retry_count + 1)

    for attempt in range(max_attempts):
        key = api_key or await km.get_next_key()
        if not key:
            logger.warning("No Hugging Face API key configured or available.")
            return None

        key_mask = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "key"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=35.0) as client:
                resp = await client.post(api_url, headers=headers, json=payload)

                # Handle rate limiting or quota exhaustion (429, 402, or specific error messages)
                if resp.status_code in (429, 402, 403, 401):
                    logger.warning(
                        f"HF key [{key_mask}] returned status {resp.status_code}: {resp.text[:200]}. Rotating key..."
                    )
                    km.report_rate_limit(key, cooldown_seconds=90)
                    if api_key:  # If caller passed explicit static key, don't loop indefinitely
                        return None
                    continue

                if resp.status_code != 200:
                    logger.warning(
                        f"HF API ({model}) returned status {resp.status_code} on key [{key_mask}]: {resp.text[:300]}"
                    )
                    # If provider doesn't support model or bad request, rotate key or retry
                    if "rate" in resp.text.lower() or "quota" in resp.text.lower() or "limit" in resp.text.lower():
                        km.report_rate_limit(key, cooldown_seconds=60)
                    continue

                data = resp.json()
                choices = data.get("choices", [])
                if not choices:
                    logger.warning(f"HF API ({model}) returned no choices on key [{key_mask}].")
                    continue

                raw_text = choices[0].get("message", {}).get("content", "")
                km.report_success(key)
                logger.info(
                    f"HF ({model}) response received via [{key_mask}] ({len(raw_text)} chars): {raw_text[:200]}..."
                )
                return raw_text

        except httpx.TimeoutException:
            logger.warning(f"HF API timeout on key [{key_mask}]. Rotating key...")
            km.report_rate_limit(key, cooldown_seconds=30)
        except Exception as e:
            logger.error(f"HF API request error on key [{key_mask}]: {e}")
            km.report_rate_limit(key, cooldown_seconds=30)

    return None


async def format_cv_with_hf(
    raw_profile: Dict[str, Any],
    job_title: str,
) -> Dict[str, Any]:
    """
    Format and enhance CV / profile data using Hugging Face Qwen 30B-class model.
    Strictly follows:
      1. Sanitize user data before building prompts.
      2. Force structured JSON schema output & validate against ProfileSchema before returning.
      3. Log raw model responses for easy debugging.
    """
    km = get_hf_key_manager()

    clean_job_title = _sanitize_job_title(job_title)
    clean_profile = _sanitize_profile_dict(raw_profile)

    if not km.has_keys():
        logger.warning("No HF_API_KEY is configured – returning sanitized profile without AI formatting.")
        clean_profile.pop("_raw_text", None)
        return clean_profile

    system_instruction = f"""You are an elite career coach and ATS resume parsing strategist.
Your task is to take raw candidate resume data (which may come from diverse resume layouts: dense paragraphs, multi-column tables, pipe-separated rows, unconventional headings, or list styles) and convert it into a structured, ATS-optimized candidate profile JSON object tailored for the target role: "{clean_job_title}".

Parsing & Formatting Rules for Diverse CV Styles:
1. PARAGRAPH / PROSE STYLES:
   - If work experiences or projects are written as narrative prose or long paragraphs, decompose them into 2-5 distinct, high-impact bullet points in "achievements".
   - Start each bullet point with a powerful past-tense action verb (e.g., Engineered, Spearheaded, Architected, Optimized, Deployed, Automated).

2. TABLES & COLUMNAR LAYOUTS:
   - If text contains pipe symbols (`|`), tabs, or side-by-side columnar data from tables (e.g. "Google | Senior Backend Engineer | 2021 - 2024 | Mountain View, CA"), accurately parse each field into its proper key (company, position, start_date, end_date, location).

3. DIVERSE / NON-STANDARD HEADINGS:
   - Map unconventional section titles accurately:
     * Experience: "Career History", "Employment", "Work Experience", "Professional Background", "Engagements", "Where I've Worked" -> experience
     * Education: "Academics", "Qualifications", "Degrees", "Academic Background", "Schooling" -> education
     * Skills: "Technical Tooling", "Tech Stack", "Proficiencies", "Competencies", "Expertise", "Core Tools" -> skills
     * Projects: "Featured Work", "Portfolio", "Open Source", "Selected Builds", "Key Initiatives" -> projects
     * Certifications: "Accreditations", "Licenses", "Courses & Certifications", "Credentials" -> certifications

4. DATES & METADATA NORMALIZATION:
   - Normalize varied date expressions (e.g., "06/2020", "June 2020", "2020 - Present", "2021 -- 2023", "Current") into clean standard representations (e.g., "Jun 2020", "Present").
   - Set "is_current" to true if the role or degree is ongoing.

5. IMPLICIT SKILLS EXTRACTION:
   - Scan all experience bullets, summaries, and project descriptions for tools, frameworks, languages, and methodologies (e.g. Docker, PostgreSQL, React, AWS, PyTorch, CI/CD). Include them in the "skills" list and deduplicate.

6. TARGET ROLE TAILORING:
   - Target Role: "{clean_job_title}".
   - Write a concise 3-4 sentence professional summary in "personal_info.summary" showcasing the candidate's strongest qualifications for this role.
   - Preserve all authentic candidate facts (names, companies, schools, real metrics). Never invent fake employment history.

Return ONLY valid JSON matching this schema:
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

    user_payload = f"Candidate Profile Data:\n{json.dumps(clean_profile, indent=2)}"

    raw_response = await _call_hf_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        retry_count=1,
    )

    if raw_response:
        try:
            # Strip markdown code fences if any
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
            # Find outermost JSON object
            json_match = re.search(r"\{[\s\S]*\}", clean_json_str)
            if json_match:
                clean_json_str = json_match.group(0)

            parsed = json.loads(clean_json_str)
            validated_schema = ProfileSchema.model_validate(parsed)
            logger.info("Successfully validated formatted profile with Pydantic ProfileSchema using Hugging Face Qwen.")
            return validated_schema.model_dump()
        except Exception as err:
            logger.error(f"Failed to parse/validate HF response: {err}. Raw response was: {raw_response[:500]}")

    # Fallback to sanitized raw profile on any failure
    logger.warning("Falling back to pre-sanitized input profile.")
    clean_profile.pop("_raw_text", None)
    return clean_profile


async def improve_bullet_with_hf(section: str, original_text: str, instruction: str) -> Dict[str, str]:
    """Improve specific section text or bullet point using Hugging Face Qwen with input sanitization."""
    km = get_hf_key_manager()

    clean_section = _sanitize_string(section, 50)
    clean_text = _sanitize_string(original_text, 2000)
    clean_inst = _sanitize_string(instruction, 300) or "Improve for impact and ATS keyword strength"

    if not clean_text:
        return {"improved_text": "", "explanation": "No text provided."}

    if not km.has_keys():
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

    raw_response = await _call_hf_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        retry_count=1,
    )

    if raw_response:
        try:
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
            json_match = re.search(r"\{[\s\S]*\}", clean_json_str)
            if json_match:
                clean_json_str = json_match.group(0)

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
