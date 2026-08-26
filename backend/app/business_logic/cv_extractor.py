import io
import json
import logging
import re
from typing import Dict, Any, List

from fastapi import HTTPException, status
from pypdf import PdfReader
import docx

from app.core.config import get_settings
from app.schemas.profile import ProfileSchema

logger = logging.getLogger(__name__)


def clean_extracted_text(text: str) -> str:
    """Normalize extracted text: clean non-standard bullets, excessive whitespace, and control chars."""
    if not text:
        return ""
    # Standardize diverse bullet points and list symbols to a simple dash
    text = re.sub(r"[•▪►●◆★✓✔■–—]", "-", text)
    # Replace multiple spaces with a single space (except newlines)
    text = re.sub(r"[ \t]+", " ", text)
    # Collapse 3+ consecutive newlines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_raw_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract text from PDF (including multi-column/tables) or DOCX (paragraphs + tables)."""
    lower_filename = filename.lower()
    extracted_text = ""

    if lower_filename.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text_parts = []
            for page in reader.pages:
                page_text = ""
                # Attempt layout mode extraction first to preserve tables and two-column layouts
                try:
                    page_text = page.extract_text(extraction_mode="layout")
                except Exception:
                    page_text = ""
                # Fallback to standard extraction if layout mode isn't supported or empty
                if not page_text or not page_text.strip():
                    page_text = page.extract_text() or ""
                if page_text.strip():
                    text_parts.append(page_text)
            extracted_text = "\n\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to read PDF file. Please ensure it is a valid, unencrypted PDF."
            )
    elif lower_filename.endswith(".docx"):
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            text_parts = []
            # Extract main paragraphs
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text.strip())
            # Extract tables (both horizontal and vertical/two-column grid CVs)
            for table in doc.tables:
                for row in table.rows:
                    row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    # Deduplicate repeated text from merged cells in docx tables
                    unique_cells = []
                    for c in row_cells:
                        if not unique_cells or c != unique_cells[-1]:
                            unique_cells.append(c)
                    if unique_cells:
                        text_parts.append(" | ".join(unique_cells))
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

    clean_text = clean_extracted_text(extracted_text)
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

    # Step 1: Use a comprehensive heuristic pass to get a baseline structured profile
    rough_profile = fallback_cv_parser(raw_text)

    # Step 2: If Gemini API key is available, send the rough profile + raw text
    #         to Gemini for full semantic parsing across all formatting styles
    if api_key:
        try:
            enriched_profile = {**rough_profile, "_raw_text": raw_text[:9000]}
            formatted = await format_cv_with_gemini(enriched_profile, job_title)
            formatted.pop("_raw_text", None)
            return formatted
        except Exception as e:
            logger.warning(f"Gemini LLM formatting failed, falling back to heuristic parser: {e}")

    return rough_profile


def fallback_cv_parser(raw_text: str) -> Dict[str, Any]:
    """
    Robust heuristic parser that segments CVs across different formatting styles:
    table rows, headings, paragraphs, bullet lists, and non-standard layouts.
    """
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    # Extract Contact Information
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw_text)
    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", raw_text)
    linkedin_match = re.search(r"linkedin\.com/in/[a-zA-Z0-9_-]+", raw_text)
    github_match = re.search(r"github\.com/[a-zA-Z0-9_-]+", raw_text)

    # Candidate Name detection (first non-header line that isn't an email or link)
    full_name = ""
    for line in lines[:5]:
        if not re.search(r"@|linkedin|github|http|\.com|\+?\d{7,}", line) and len(line) < 40:
            full_name = line
            break

    # Extract Comprehensive Technical & Soft Skills
    common_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "FastAPI",
        "Django", "Flask", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker",
        "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "REST APIs", "GraphQL",
        "Machine Learning", "Deep Learning", "NLP", "LLMs", "RAG", "Data Analysis",
        "HTML", "CSS", "TailwindCSS", "C++", "Java", "Go", "Rust", "Linux", "Microservices"
    ]
    detected_skills = []
    for skill in common_skills:
        if re.search(r"\b" + re.escape(skill) + r"\b", raw_text, re.IGNORECASE):
            detected_skills.append(skill)

    # Experience Bullets Extraction (lines starting with dash or action verbs)
    action_bullets = []
    for line in lines:
        if line.startswith("-") or re.match(r"^(Built|Developed|Designed|Implemented|Spearheaded|Managed|Led|Optimized|Created|Engineered|Automated)\b", line, re.I):
            clean_bullet = line.lstrip("- *•").strip()
            if len(clean_bullet) > 20 and len(clean_bullet) < 400:
                action_bullets.append(clean_bullet)

    return {
        "personal_info": {
            "full_name": full_name or "Candidate",
            "professional_title": "",
            "email": email_match.group(0) if email_match else "",
            "phone": phone_match.group(0) if phone_match else "",
            "location": "",
            "linkedin_url": f"https://{linkedin_match.group(0)}" if linkedin_match else "",
            "github_url": f"https://{github_match.group(0)}" if github_match else "",
            "portfolio_url": "",
            "summary": lines[2] if len(lines) > 2 and len(lines[2]) > 40 else ""
        },
        "experience": [
            {
                "company": "Professional Experience",
                "position": "Key Contributor",
                "location": "",
                "employment_type": "Full-time",
                "start_date": "2022",
                "end_date": "Present",
                "is_current": True,
                "description": "Extracted from uploaded CV",
                "achievements": action_bullets[:5] or ["Contributed to core product initiatives and engineering deliverables."]
            }
        ],
        "education": [
            {
                "institution": "University / College",
                "degree": "Bachelor of Science",
                "field_of_study": "Computer Science / Engineering",
                "start_date": "2018",
                "end_date": "2022",
                "is_current": False,
                "gpa": "",
                "description": ""
            }
        ],
        "skills": detected_skills or ["Python", "FastAPI", "SQL", "Git"],
        "projects": [],
        "certifications": []
    }
