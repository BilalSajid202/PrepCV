import json
import logging
import re
from typing import Dict, Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

XAI_API_URL = "https://api.x.ai/v1/chat/completions"
GROK_MODEL = "grok-3-mini"


async def format_cv_with_grok(
    raw_profile: Dict[str, Any],
    job_title: str,
) -> Dict[str, Any]:
    """
    Send raw-extracted CV profile data to the Grok (xAI) LLM.
    The model populates missing fields, fixes formatting, and enhances
    descriptions so that they are tailored for the given *job_title*.

    Returns the cleaned / formatted profile dict matching the ProfileSchema.
    Falls back to returning the raw_profile unchanged if the API call fails.
    """
    settings = get_settings()
    api_key = settings.xai_api_key

    if not api_key:
        logger.warning("XAI_API_KEY is not set – skipping Grok formatting, returning raw profile.")
        return raw_profile

    system_prompt = f"""You are an expert resume data formatter and career advisor.
You will receive a candidate's extracted resume/CV data as JSON and a target job title.

Target Job Title: {job_title}

Your tasks:
1. Populate any missing or empty fields with reasonable professional defaults based on the available data and the target job title.
2. Rewrite the professional summary to be compelling, concise (3-4 sentences), and targeted for the "{job_title}" position.
3. Polish experience descriptions and achievement bullets:
   - Start each bullet with strong action verbs (e.g., Engineered, Optimized, Deployed, Spearheaded).
   - Add quantifiable metrics where plausible.
   - Tailor language for the target "{job_title}" role.
4. Ensure skills are relevant and well-organized for the target role.
5. Format dates consistently (e.g., "Jan 2023", "2021 - Present").
6. Keep all factual information (names, companies, institutions) unchanged.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{{
  "personal_info": {{
    "full_name": "...",
    "professional_title": "{job_title}",
    "email": "...",
    "phone": "...",
    "location": "...",
    "linkedin_url": "...",
    "github_url": "...",
    "portfolio_url": "...",
    "summary": "..."
  }},
  "experience": [
    {{
      "company": "...",
      "position": "...",
      "location": "...",
      "employment_type": "...",
      "start_date": "...",
      "end_date": "...",
      "is_current": true/false,
      "description": "...",
      "achievements": ["...", "..."]
    }}
  ],
  "education": [
    {{
      "institution": "...",
      "degree": "...",
      "field_of_study": "...",
      "start_date": "...",
      "end_date": "...",
      "is_current": true/false,
      "gpa": "...",
      "description": "..."
    }}
  ],
  "skills": ["...", "..."],
  "projects": [
    {{
      "name": "...",
      "description": "...",
      "technologies": ["..."],
      "project_url": "...",
      "github_url": "...",
      "achievements": ["..."]
    }}
  ],
  "certifications": [
    {{
      "name": "...",
      "issuing_organization": "...",
      "issue_date": "...",
      "expiration_date": "...",
      "credential_id": "...",
      "credential_url": "..."
    }}
  ]
}}"""

    user_message = f"Here is the candidate's extracted CV data:\n{json.dumps(raw_profile, indent=2)}"

    payload = {
        "model": GROK_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.2,
        "max_tokens": 4096,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(XAI_API_URL, json=payload, headers=headers)

            if resp.status_code != 200:
                logger.error(f"Grok API returned status {resp.status_code}: {resp.text[:500]}")
                return raw_profile

            res_data = resp.json()
            choices = res_data.get("choices", [])
            if not choices:
                logger.warning("Grok API returned no choices.")
                return raw_profile

            content_text = choices[0].get("message", {}).get("content", "")
            if not content_text:
                logger.warning("Grok API returned empty content.")
                return raw_profile

            # Strip possible markdown fences
            clean_json_str = re.sub(
                r"^```(?:json)?\s*|\s*```$", "", content_text.strip(), flags=re.MULTILINE
            )
            formatted_profile = json.loads(clean_json_str)

            logger.info("Grok successfully formatted CV data for job title: %s", job_title)
            return formatted_profile

    except json.JSONDecodeError as e:
        logger.error(f"Grok response JSON parse error: {e}")
        return raw_profile
    except httpx.TimeoutException:
        logger.error("Grok API request timed out.")
        return raw_profile
    except Exception as e:
        logger.error(f"Grok API unexpected error: {e}")
        return raw_profile
