import asyncio
import json
import logging
import re
import time
from typing import Dict, Any, List, Optional, Tuple

import httpx

from app.core.config import get_settings
from app.schemas.profile import ProfileSchema

logger = logging.getLogger(__name__)

# Default model (can be overridden via HF_MODEL in .env)
DEFAULT_HF_MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct"
DEFAULT_HF_API_URL = "https://router.huggingface.co/v1/chat/completions"


class HFKeyManager:
    """
    Thread-safe rotating API Key Manager for Hugging Face with per-key expiry
    timestamps and non-blocking failover.
    """

    def __init__(self):
        self._lock = asyncio.Lock()
        self._keys: List[str] = []
        self._current_index: int = 0
        self._available_at: Dict[str, float] = {}  # key -> epoch timestamp when key becomes available
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

    @property
    def active_key_count(self) -> int:
        self._reload_keys()
        now = time.time()
        active = [k for k in self._keys if self._available_at.get(k, 0) <= now]
        return len(active) if active else len(self._keys)

    def has_keys(self) -> bool:
        return self.key_count > 0

    async def get_best_key(self, max_allowed_wait_seconds: float = 2.0) -> Tuple[Optional[str], float]:
        """
        Non-blocking key selector:
        1. Always inspect all keys and their available_at timestamps.
        2. Prioritize immediately free keys (available_at <= now).
        3. If all keys are in cooldown, pick the one with the earliest available_at timestamp.
        4. If wait time for the earliest key is <= max_allowed_wait_seconds (e.g. 2s),
           do a short bounded wait.
        5. If wait time > max_allowed_wait_seconds, return (None, wait_time) immediately
           so the calling pipeline can failover without stalling.
        """
        async with self._lock:
            self._reload_keys()
            if not self._keys:
                return None, 0.0

            now = time.time()
            # Check for currently free keys
            free_keys = [k for k in self._keys if self._available_at.get(k, 0) <= now]
            if free_keys:
                self._current_index = (self._current_index + 1) % len(free_keys)
                return free_keys[self._current_index], 0.0

            # All keys are in cooldown - find the key with earliest available_at
            earliest_key = min(self._keys, key=lambda k: self._available_at.get(k, 0))
            earliest_time = self._available_at.get(earliest_key, 0)
            wait_time = max(0.0, earliest_time - now)

            if wait_time <= max_allowed_wait_seconds:
                # Bounded short wait
                logger.info(
                    f"All HF keys in cooldown. Earliest key available in {wait_time:.1f}s. "
                    f"Performing short bounded wait ({wait_time:.1f}s)..."
                )
                await asyncio.sleep(wait_time)
                return earliest_key, wait_time

            # Cooldown is too long (> 2s) -> trigger non-blocking failover immediately!
            logger.warning(
                f"HF key pool exhausted. Soonest key available in {wait_time:.1f}s (>{max_allowed_wait_seconds}s). "
                f"Triggering non-blocking fast failover."
            )
            return None, wait_time

    async def get_next_key(self) -> Optional[str]:
        """Legacy compatibility wrapper for get_best_key."""
        key, _ = await self.get_best_key(max_allowed_wait_seconds=2.0)
        return key

    def report_rate_limit(self, key: str, cooldown_seconds: int = 30) -> None:
        """Mark a key as rate-limited / tier-exhausted with an expiry timestamp."""
        mask = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "key"
        self._available_at[key] = time.time() + cooldown_seconds
        now = time.time()
        active_left = len([k for k in self._keys if self._available_at.get(k, 0) <= now])
        logger.warning(
            f"Hugging Face key [{mask}] reached rate-limit/quota. Placed on {cooldown_seconds}s cooldown. "
            f"Active keys available: {active_left}/{len(self._keys)}"
        )

    def report_timeout(self, key: str, cooldown_seconds: int = 5) -> None:
        """Mark a key on short transient cooldown for network timeout / connection glitch."""
        mask = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "key"
        self._available_at[key] = time.time() + cooldown_seconds
        logger.warning(
            f"HF API timeout on key [{mask}]. Short {cooldown_seconds}s cooldown applied. Rotating..."
        )

    def report_success(self, key: str) -> None:
        """Clear cooldown on successful call."""
        if key in self._available_at:
            del self._available_at[key]


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
    max_tokens: int = 4096,
) -> Optional[Dict[str, Any]]:
    """
    Call Hugging Face Router chat completions API forcing JSON output.
    Uses rotating API keys with automatic failover when a key hits rate limits or quota tiers.

    Returns a dict with:
      - "content": the raw text response
      - "usage": {"prompt_tokens": int, "completion_tokens": int, "total_tokens": int}
      - "model": the model name used
      - "api_key_hint": masked key string
      - "response_time_ms": int
    Or None if all attempts fail.
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
        "max_tokens": max_tokens,
    }

    # Bound attempts to at most 2 (1 primary + 1 failover key) to never stall the request pipeline
    max_attempts = min(max(retry_count + 1, 1), 2)

    for attempt in range(max_attempts):
        if api_key:
            key = api_key
        else:
            key, wait_time = await km.get_best_key(max_allowed_wait_seconds=2.0)

        if not key:
            logger.warning(
                "No Hugging Face API key available within non-blocking window. Fast failover to local engine."
            )
            return None

        key_mask = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "key"
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

        call_start = time.time()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(api_url, headers=headers, json=payload)

            response_time_ms = int((time.time() - call_start) * 1000)

            # Handle rate limiting or quota exhaustion (429, 402, 403, 401)
            if resp.status_code in (429, 402, 403, 401):
                logger.warning(
                    f"HF key [{key_mask}] returned status {resp.status_code}: {resp.text[:200]}. Rotating key..."
                )
                km.report_rate_limit(key, cooldown_seconds=30)
                if api_key:  # If caller passed explicit static key, don't loop indefinitely
                    return None
                continue

            if resp.status_code != 200:
                logger.warning(
                    f"HF API ({model}) returned status {resp.status_code} on key [{key_mask}]: {resp.text[:300]}"
                )
                if "rate" in resp.text.lower() or "quota" in resp.text.lower() or "limit" in resp.text.lower():
                    km.report_rate_limit(key, cooldown_seconds=30)
                else:
                    km.report_timeout(key, cooldown_seconds=5)
                continue

            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                logger.warning(f"HF API ({model}) returned no choices on key [{key_mask}].")
                km.report_timeout(key, cooldown_seconds=5)
                continue

            raw_text = choices[0].get("message", {}).get("content", "")
            km.report_success(key)

            # Extract token usage from the API response
            usage = data.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)

            logger.info(
                f"HF ({model}) response via [{key_mask}] | "
                f"{len(raw_text)} chars | "
                f"tokens: {prompt_tokens}in/{completion_tokens}out/{total_tokens}total | "
                f"{response_time_ms}ms"
            )

            return {
                "content": raw_text,
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                },
                "model": model,
                "api_key_hint": key_mask,
                "response_time_ms": response_time_ms,
            }

        except httpx.TimeoutException:
            logger.warning(f"HF API timeout on key [{key_mask}]. Rotating key...")
            km.report_timeout(key, cooldown_seconds=5)
        except Exception as e:
            logger.error(f"HF API request error on key [{key_mask}]: {e}")
            km.report_timeout(key, cooldown_seconds=5)

    return None


async def log_ai_usage(
    user_id: Optional[str],
    feature: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    response_time_ms: int,
    status: str = "success",
    api_key_hint: str = "",
    error_message: Optional[str] = None,
) -> None:
    """Persist an AI usage log record to the database with comprehensive error handling."""
    import traceback
    try:
        from app.database.session import get_session_factory
        from app.database.models import AIUsageLog

        factory = get_session_factory()
        async with factory() as session:
            log_entry = AIUsageLog(
                user_id=user_id,
                feature=feature,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                response_time_ms=response_time_ms,
                status=status,
                api_key_hint=api_key_hint,
                error_message=error_message,
            )
            session.add(log_entry)
            await session.commit()
            logger.info(
                f"[✓ LOGGED] AI usage: user={user_id}, feature={feature}, model={model}, "
                f"tokens={total_tokens} (in:{input_tokens} out:{output_tokens}), status={status}, {response_time_ms}ms"
            )
    except Exception as e:
        # Log the full error for debugging, but never let logging break the main flow
        logger.error(
            f"[✗ LOG FAILED] Could not persist AI usage log. Error: {e}\nContext: "
            f"user={user_id}, feature={feature}, tokens={total_tokens}\n"
            f"Traceback:\n{traceback.format_exc()}"
        )


async def format_cv_with_hf(
    raw_profile: Dict[str, Any],
    job_title: str,
    user_id: Optional[str] = None,
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

    api_result = await _call_hf_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        retry_count=1,
    )

    if api_result:
        raw_response = api_result["content"]
        usage = api_result.get("usage", {})

        # Log usage
        await log_ai_usage(
            user_id=user_id,
            feature="cv_formatting",
            model=api_result.get("model", ""),
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            response_time_ms=api_result.get("response_time_ms", 0),
            status="success",
            api_key_hint=api_result.get("api_key_hint", ""),
        )

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


async def improve_bullet_with_hf(section: str, original_text: str, instruction: str, user_id: Optional[str] = None) -> Dict[str, str]:
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

    api_result = await _call_hf_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        retry_count=1,
    )

    if api_result:
        raw_response = api_result["content"]
        usage = api_result.get("usage", {})

        # Log usage
        await log_ai_usage(
            user_id=user_id,
            feature="ai_improve",
            model=api_result.get("model", ""),
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            response_time_ms=api_result.get("response_time_ms", 0),
            status="success",
            api_key_hint=api_result.get("api_key_hint", ""),
        )

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


async def extract_cv_with_hf(
    raw_text: str,
    job_title: str = "",
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    AI-first CV extraction: send raw resume text directly to Hugging Face Qwen LLM
    for structured data extraction. This is the primary extraction path — the raw text
    is the ONLY input, so the AI must extract everything from scratch.

    Returns a validated ProfileSchema-compatible dict, or None if all keys fail.
    """
    km = get_hf_key_manager()

    if not km.has_keys():
        logger.warning("No HF API keys configured — cannot perform AI CV extraction.")
        return None

    clean_job_title = _sanitize_job_title(job_title)
    # Send up to 8000 chars of raw text for optimal latency and coverage
    clean_text = _sanitize_string(raw_text, 8000)

    if not clean_text or len(clean_text) < 20:
        logger.warning("Raw text too short for AI extraction.")
        return None

    system_instruction = f"""You are an expert CV/Resume parser. Your task is to extract ALL structured information from raw resume text into a precise JSON object.

The raw text below was extracted from a PDF or Word document. It may contain layout artifacts such as:
- Pipe characters (|) from table rows
- Extra whitespace from multi-column layouts
- Section headings in UPPERCASE or with underlines
- Bullet characters (-, *, •)
- Dates in various formats (e.g., "Dec 2024 – Present", "06/2020", "2021 -- 2023")

EXTRACTION RULES:

1. PERSONAL INFORMATION:
   - Extract the candidate's FULL NAME (usually the largest/first text on the resume).
   - Extract their professional title/headline (e.g., "Software Engineer • AI / Machine Learning Developer • Jr. Lecturer").
   - Extract email, phone number, and location (city, country).
   - Extract LinkedIn URL, GitHub URL, and portfolio/website URL if present.
   - For "summary": Extract the PROFESSIONAL SUMMARY paragraph from the resume. This is typically a 2-4 sentence paragraph describing the candidate's background. Do NOT put contact info here.

2. WORK EXPERIENCE - CRITICAL:
   - Extract EVERY individual work experience entry separately. Each entry MUST have:
     * "company": The actual company/organization name (e.g., "OmniClouds", "Superior University", "Google")
     * "position": The actual job title (e.g., "Artificial Intelligence Developer", "Junior Lecturer", "Machine Learning Engineer")
     * "location": Job location if mentioned (e.g., "Remote", "Lahore, Pakistan")
     * "employment_type": "Full-time", "Part-time", "Contract", "Contractual", "Remote", "Internship" — infer from context
     * "start_date": Actual start date (normalize to format like "Dec 2024", "Nov 2023", "Apr 2023")
     * "end_date": Actual end date or "Present" if current
     * "is_current": true if the role is ongoing (end date is "Present" or "Current")
     * "description": Brief role description if available, otherwise empty string
     * "achievements": Array of bullet points describing what the candidate did in this role. Extract the ACTUAL bullet points from the resume text.
   - NEVER merge multiple jobs into one entry. NEVER use placeholder text like "Key Contributor" or "Professional Experience" as company/position names.
   - If the resume has 4 jobs, you must return 4 experience entries.

3. EDUCATION:
   - Extract EVERY education entry with real institution names, degrees, fields of study, dates, and GPA if mentioned.
   - Example: institution="Superior University", degree="Bachelor of Science", field_of_study="Software Engineering", gpa="3.68"

4. SKILLS:
   - Extract ALL skills mentioned anywhere in the resume — from dedicated skills sections, experience bullets, project descriptions, etc.
   - Include programming languages, frameworks, tools, databases, platforms, methodologies, and soft skills.
   - Return as a flat array of strings. Deduplicate.

5. PROJECTS:
   - Extract any projects mentioned with name, description, technologies used, URLs, and key achievements.

6. CERTIFICATIONS:
   - Extract any certifications, courses, or credentials with name, issuing organization, and dates.

Target Role Context: "{clean_job_title}"
If relevant, tailor the professional summary for this role, but NEVER invent fake information.

Return ONLY valid JSON matching this exact schema:
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

    user_payload = f"RAW RESUME TEXT TO EXTRACT FROM:\n\n{clean_text}"

    api_result = await _call_hf_json_api(
        system_instruction=system_instruction,
        user_payload=user_payload,
        retry_count=1,
        max_tokens=3000,
    )

    if api_result:
        raw_response = api_result["content"]
        usage = api_result.get("usage", {})

        # Log AI token usage
        await log_ai_usage(
            user_id=user_id,
            feature="cv_extraction",
            model=api_result.get("model", ""),
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            response_time_ms=api_result.get("response_time_ms", 0),
            status="success",
            api_key_hint=api_result.get("api_key_hint", ""),
        )

        try:
            # Strip markdown code fences if any
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
            # Find outermost JSON object
            json_match = re.search(r"\{[\s\S]*\}", clean_json_str)
            if json_match:
                clean_json_str = json_match.group(0)

            parsed = json.loads(clean_json_str)
            validated_schema = ProfileSchema.model_validate(parsed)
            result = validated_schema.model_dump()

            # Validate that AI actually extracted real data (not placeholders)
            exp_list = result.get("experience", [])
            if exp_list:
                first_exp = exp_list[0]
                # Check for known placeholder values that would indicate a bad extraction
                placeholder_companies = {"professional experience", "key contributor", "company", "organization"}
                if first_exp.get("company", "").lower().strip() in placeholder_companies:
                    logger.warning("AI extraction returned placeholder company names — treating as failed extraction.")
                    return None

            logger.info(
                f"Successfully extracted CV with AI: {len(result.get('experience', []))} experiences, "
                f"{len(result.get('education', []))} education, {len(result.get('skills', []))} skills."
            )
            return result
        except Exception as err:
            logger.error(f"Failed to parse/validate AI CV extraction response: {err}. Raw: {raw_response[:500]}")

    return None
