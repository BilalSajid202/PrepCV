import io
import json
import logging
import re
from typing import Dict, Any, List, Optional

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


async def parse_cv_text_with_llm(raw_text: str, job_title: str = "", user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    AI-first CV extraction pipeline:
    1. Send raw text directly to AI for full structured extraction (primary path)
    2. Fall back to improved heuristic parser only if AI is unavailable or fails
    """
    from app.integrations.huggingface.client import extract_cv_with_hf, get_hf_key_manager

    km = get_hf_key_manager()

    # PRIMARY PATH: AI extraction directly from raw text
    if km.has_keys():
        try:
            logger.info("==> [CV Parser] Attempting AI-first extraction from raw text...")
            ai_result = await extract_cv_with_hf(raw_text, job_title=job_title, user_id=user_id)
            if ai_result:
                logger.info(
                    f"==> [CV Parser] AI extraction succeeded: "
                    f"{len(ai_result.get('experience', []))} experiences, "
                    f"{len(ai_result.get('education', []))} education, "
                    f"{len(ai_result.get('skills', []))} skills."
                )
                return ai_result
            else:
                logger.warning("==> [CV Parser] AI extraction returned None, falling back to heuristic parser.")
        except Exception as e:
            logger.warning(f"==> [CV Parser] AI extraction failed with error: {e}. Falling back to heuristic parser.")

    # FALLBACK: Improved heuristic parser (only when AI is unavailable)
    logger.info("==> [CV Parser] Using heuristic fallback parser (no AI keys available or AI failed).")
    return fallback_cv_parser(raw_text)


def fallback_cv_parser(raw_text: str) -> Dict[str, Any]:
    """
    Improved heuristic parser that extracts structured data from raw CV text.
    Used ONLY as a last-resort fallback when all AI extraction paths fail.
    Attempts section-aware parsing to extract multiple experience/education entries.
    """
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    # ── Extract Contact Information ──
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw_text)
    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,7}", raw_text)
    linkedin_match = re.search(r"linkedin\.com/in/[a-zA-Z0-9_-]+", raw_text)
    github_match = re.search(r"github\.com/[a-zA-Z0-9_-]+", raw_text)
    portfolio_match = re.search(r"(?:portfolio|website)[:\s]*(https?://[^\s]+)", raw_text, re.IGNORECASE)

    # ── Candidate Name (first non-header line that isn't an email or link) ──
    full_name = ""
    for line in lines[:5]:
        if not re.search(r"@|linkedin|github|http|\.com|\+?\d{7,}", line, re.IGNORECASE) and len(line) < 50:
            full_name = line
            break

    # ── Professional Title (line after name, usually contains job title keywords) ──
    professional_title = ""
    title_keywords = r"(?:engineer|developer|designer|analyst|manager|consultant|architect|scientist|lecturer|teacher|assistant|intern|lead|senior|junior|full.?stack|front.?end|back.?end|devops|data|machine.?learning|ai|ml|software)"
    for line in lines[1:6]:
        if re.search(title_keywords, line, re.IGNORECASE) and len(line) < 120:
            professional_title = line
            break

    # ── Location ──
    location = ""
    location_match = re.search(r"(?:^|\|)\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*(?:$|\|)", raw_text, re.MULTILINE)
    if location_match:
        location = location_match.group(1).strip()

    # ── Professional Summary ──
    summary = ""
    summary_section_pattern = re.compile(
        r"(?:PROFESSIONAL\s+SUMMARY|SUMMARY|PROFILE|OBJECTIVE|ABOUT\s+ME|CAREER\s+SUMMARY)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS|CORE\s+SKILLS|PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT|TECHNICAL)|$)",
        re.IGNORECASE
    )
    summary_match = summary_section_pattern.search(raw_text)
    if summary_match:
        summary_text = summary_match.group(1).strip()
        # Take the first substantial paragraph
        for para in summary_text.split("\n\n"):
            clean_para = para.strip()
            if len(clean_para) > 40:
                summary = clean_para
                break

    # ── Experience Extraction (section-aware) ──
    experiences = []
    exp_section_pattern = re.compile(
        r"(?:PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT\s+HISTORY|CAREER\s+HISTORY)\s*\n([\s\S]*?)(?=\n\s*(?:EDUCATION|ACADEMIC|SKILLS|PROJECTS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|CORE\s+SKILLS|$))",
        re.IGNORECASE
    )
    exp_match = exp_section_pattern.search(raw_text)
    if exp_match:
        exp_text = exp_match.group(1)
        # Split individual experience entries by detecting company/role lines with dates
        # Pattern: "Company Name | Job Title" or "Company Name  Job Title  Date - Date"
        entry_pattern = re.compile(
            r"^(.+?)(?:\s*\|\s*(.+?))?\s*(?:(\w{3,9}\s+\d{4}|[A-Z][a-z]{2}\s+\d{4}|\d{4})\s*[-–—]\s*(\w{3,9}\s+\d{4}|[A-Z][a-z]{2}\s+\d{4}|\d{4}|Present|Current))?\s*$",
            re.MULTILINE | re.IGNORECASE
        )
        exp_lines = exp_text.strip().splitlines()

        current_entry = None
        current_bullets = []

        for line in exp_lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Check if this line looks like a new role header (contains date range or company|title pattern)
            date_range_match = re.search(
                r"(\w{3,9}\s+\d{4}|[A-Z][a-z]{2}\s+\d{4}|\d{4})\s*[-–—]\s*(Present|Current|\w{3,9}\s+\d{4}|[A-Z][a-z]{2}\s+\d{4}|\d{4})",
                stripped, re.IGNORECASE
            )

            has_pipe = "|" in stripped
            is_header = date_range_match or (has_pipe and len(stripped) < 200 and not stripped.startswith("-"))

            if is_header and (len(stripped) > 10):
                # Save previous entry
                if current_entry:
                    current_entry["achievements"] = current_bullets
                    experiences.append(current_entry)
                    current_bullets = []

                # Parse this header line
                company = ""
                position = ""
                start_date = ""
                end_date = ""
                is_current = False

                if date_range_match:
                    start_date = date_range_match.group(1)
                    end_date = date_range_match.group(2)
                    if end_date.lower() in ("present", "current"):
                        is_current = True

                # Remove date range from line to parse company/title
                header_text = stripped
                if date_range_match:
                    header_text = stripped[:date_range_match.start()].strip()

                parts = [p.strip() for p in header_text.split("|") if p.strip()]
                if len(parts) >= 2:
                    company = parts[0]
                    position = parts[1]
                elif len(parts) == 1:
                    # Could be "Company" on one line and position on the next
                    company = parts[0]

                # Clean up parenthetical info from position like "(Remote)" or "(Contractual)"
                emp_type = "Full-time"
                emp_type_match = re.search(r"\((Remote|Contractual|Contract|Part-time|Internship|Full-time)\)", position, re.IGNORECASE)
                if emp_type_match:
                    emp_type = emp_type_match.group(1).capitalize()
                    position = position[:emp_type_match.start()].strip()

                current_entry = {
                    "company": company,
                    "position": position,
                    "location": "",
                    "employment_type": emp_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_current": is_current,
                    "description": "",
                    "achievements": [],
                }
            elif stripped.startswith("-") or stripped.startswith("*"):
                bullet = stripped.lstrip("- *•").strip()
                if len(bullet) > 15:
                    current_bullets.append(bullet)
            elif re.match(r"^(Built|Developed|Designed|Implemented|Spearheaded|Managed|Led|Optimized|Created|Engineered|Automated|Delivered|Collaborated|Applied|Contributed)\b", stripped, re.I):
                if len(stripped) > 20:
                    current_bullets.append(stripped)

        # Don't forget the last entry
        if current_entry:
            current_entry["achievements"] = current_bullets
            experiences.append(current_entry)

    # If section parsing found nothing, create a minimal entry from action bullets
    if not experiences:
        action_bullets = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("-") or re.match(r"^(Built|Developed|Designed|Implemented|Spearheaded|Managed|Led|Optimized|Created|Engineered|Automated)\b", stripped, re.I):
                clean_bullet = stripped.lstrip("- *•").strip()
                if 20 < len(clean_bullet) < 400:
                    action_bullets.append(clean_bullet)

        if action_bullets:
            experiences.append({
                "company": "",
                "position": "",
                "location": "",
                "employment_type": "Full-time",
                "start_date": "",
                "end_date": "",
                "is_current": False,
                "description": "Extracted from uploaded CV (heuristic fallback)",
                "achievements": action_bullets[:8],
            })

    # ── Education Extraction ──
    education = []
    edu_section_pattern = re.compile(
        r"(?:EDUCATION|ACADEMIC|QUALIFICATIONS|DEGREES)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|SKILLS|PROJECTS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|PROFESSIONAL|CORE\s+SKILLS|$))",
        re.IGNORECASE
    )
    edu_match = edu_section_pattern.search(raw_text)
    if edu_match:
        edu_text = edu_match.group(1).strip()
        edu_lines = [l.strip() for l in edu_text.splitlines() if l.strip()]
        current_edu = None
        for line in edu_lines:
            # Look for institution names (usually followed by degree or date)
            date_match = re.search(
                r"(\w{3,9}\s+\d{4}|[A-Z][a-z]{2}\s+\d{4}|\d{4})\s*[-–—]\s*(Present|Current|\w{3,9}\s+\d{4}|[A-Z][a-z]{2}\s+\d{4}|\d{4})",
                line, re.IGNORECASE
            )
            gpa_match = re.search(r"(?:GPA|CGPA)[:\s]*(\d+\.?\d*)", line, re.IGNORECASE)

            if date_match or ("|" in line and len(line) < 200):
                if current_edu:
                    education.append(current_edu)

                parts = [p.strip() for p in line.split("|") if p.strip()]
                institution = parts[0] if parts else ""
                degree = parts[1] if len(parts) > 1 else ""
                field = parts[2] if len(parts) > 2 else ""

                # Clean date from institution/degree text
                if date_match:
                    institution = line[:date_match.start()].strip()
                    parts = [p.strip() for p in institution.split("|") if p.strip()]
                    institution = parts[0] if parts else institution
                    degree = parts[1] if len(parts) > 1 else degree

                current_edu = {
                    "institution": institution,
                    "degree": degree,
                    "field_of_study": field,
                    "start_date": date_match.group(1) if date_match else "",
                    "end_date": date_match.group(2) if date_match else "",
                    "is_current": date_match.group(2).lower() in ("present", "current") if date_match else False,
                    "gpa": gpa_match.group(1) if gpa_match else "",
                    "description": "",
                }
            elif current_edu and gpa_match:
                current_edu["gpa"] = gpa_match.group(1)

        if current_edu:
            education.append(current_edu)

    # ── Skills Extraction ──
    common_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "FastAPI",
        "Django", "Flask", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker",
        "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "REST APIs", "GraphQL",
        "Machine Learning", "Deep Learning", "NLP", "LLMs", "RAG", "Data Analysis",
        "HTML", "CSS", "TailwindCSS", "C++", "Java", "Go", "Rust", "Linux", "Microservices",
        "PyTorch", "TensorFlow", "FAISS", "Computer Vision", "Predictive Modeling",
        "Bootstrap", "jQuery", "PHP", "Firebase", "MSSQL", "XML", "UML",
        "Java Swing", "FastAPI", "Flask", "Jupyter", "VS Code", "GitHub",
        "Agile", "Scrum", "OOP", "Data Structures", "Algorithms",
    ]
    detected_skills = []
    for skill in common_skills:
        if re.search(r"\b" + re.escape(skill) + r"\b", raw_text, re.IGNORECASE):
            if skill not in detected_skills:
                detected_skills.append(skill)

    return {
        "personal_info": {
            "full_name": full_name or "Candidate",
            "professional_title": professional_title,
            "email": email_match.group(0) if email_match else "",
            "phone": phone_match.group(0) if phone_match else "",
            "location": location,
            "linkedin_url": f"https://{linkedin_match.group(0)}" if linkedin_match else "",
            "github_url": f"https://{github_match.group(0)}" if github_match else "",
            "portfolio_url": portfolio_match.group(1) if portfolio_match else "",
            "summary": summary,
        },
        "experience": experiences,
        "education": education,
        "skills": detected_skills or ["Python", "FastAPI", "SQL", "Git"],
        "projects": [],
        "certifications": [],
    }

