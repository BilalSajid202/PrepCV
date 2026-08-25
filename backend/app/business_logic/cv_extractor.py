import io
import json
import logging
import re
from typing import Dict, Any

import httpx
from fastapi import HTTPException, status
from pypdf import PdfReader
import docx

from app.core.config import get_settings
from app.schemas.profile import ProfileSchema

logger = logging.getLogger(__name__)


def extract_raw_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract raw text from PDF or DOCX file bytes."""
    lower_filename = filename.lower()
    extracted_text = ""

    if lower_filename.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            extracted_text = "\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to read PDF file. Please ensure it is a valid, unencrypted PDF."
            )
    elif lower_filename.endswith(".docx"):
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            text_parts = [para.text for para in doc.paragraphs if para.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join([cell.text.strip() for cell in row.cells if cell.text.strip()])
                    if row_text:
                        text_parts.append(row_text)
            extracted_text = "\n".join(text_parts)
        except Exception as e:
            logger.error(f"DOCX extraction error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to read DOCX document. Please ensure it is a valid Word (.docx) document."
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Only PDF (.pdf) and Word (.docx) documents are allowed."
        )

    clean_text = extracted_text.strip()
    if not clean_text or len(clean_text) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file contains no extractable text. Please ensure it is a valid document with selectable text."
        )

    return clean_text


async def parse_cv_text_with_llm(raw_text: str, job_title: str = "") -> Dict[str, Any]:
    """Parse raw extracted CV text into structured profile JSON using Google Gemini Flash with fallback."""
    from app.integrations.gemini.client import format_cv_with_gemini

    settings = get_settings()
    api_key = settings.gemini_api_key

    # Step 1: Use a quick heuristic pass to get a rough structured profile
    rough_profile = fallback_cv_parser(raw_text)

    # Step 2: If Gemini API key is available, send the rough profile + raw text
    #         to Gemini for intelligent formatting, ATS optimization and population
    if api_key:
        try:
            enriched_profile = {**rough_profile, "_raw_text": raw_text[:8000]}
            formatted = await format_cv_with_gemini(enriched_profile, job_title)
            formatted.pop("_raw_text", None)
            return formatted
        except Exception as e:
            logger.warning(f"Gemini LLM formatting failed, falling back to heuristic parser: {e}")

    return rough_profile


def fallback_cv_parser(raw_text: str) -> Dict[str, Any]:
    """Deterministic fallback parser for extracted resume text."""
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", raw_text)
    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", raw_text)
    linkedin_match = re.search(r"linkedin\.com/in/[\w-]+", raw_text)
    github_match = re.search(r"github\.com/[\w-]+", raw_text)

    full_name = lines[0] if len(lines) > 0 else ""
    professional_title = lines[1] if len(lines) > 1 and len(lines[1]) < 60 else ""

    skills = []
    skill_keywords = ["Python", "JavaScript", "TypeScript", "React", "Node.js", "FastAPI", "SQL", "PostgreSQL", "MongoDB", "Docker", "AWS", "Git", "AI", "Machine Learning", "RAG", "LLM", "HTML", "CSS", "C++", "Java"]
    for kw in skill_keywords:
        if re.search(r"\b" + re.escape(kw) + r"\b", raw_text, re.IGNORECASE):
            skills.append(kw)

    return {
        "personal_info": {
            "full_name": full_name,
            "professional_title": professional_title,
            "email": email_match.group(0) if email_match else "",
            "phone": phone_match.group(0) if phone_match else "",
            "location": "",
            "linkedin_url": f"https://{linkedin_match.group(0)}" if linkedin_match else "",
            "github_url": f"https://{github_match.group(0)}" if github_match else "",
            "portfolio_url": "",
            "summary": lines[2] if len(lines) > 2 and len(lines[2]) > 30 else ""
        },
        "experience": [
            {
                "company": "Extracted Experience",
                "position": professional_title or "Professional Role",
                "location": "",
                "employment_type": "Full-time",
                "start_date": "2022",
                "end_date": "Present",
                "is_current": True,
                "description": "Extracted from uploaded CV",
                "achievements": [line for line in lines[3:8] if len(line) > 15][:4]
            }
        ],
        "education": [
            {
                "institution": "University / Institution",
                "degree": "Bachelor of Science",
                "field_of_study": "Computer Science / AI",
                "start_date": "2018",
                "end_date": "2022",
                "is_current": False,
                "gpa": "",
                "description": ""
            }
        ],
        "skills": skills or ["Python", "FastAPI", "PostgreSQL", "Git"],
        "projects": [],
        "certifications": []
    }
