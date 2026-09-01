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
    3. Log usage regardless of which path is taken
    """
    from app.integrations.huggingface.client import extract_cv_with_hf, get_hf_key_manager, log_ai_usage

    km = get_hf_key_manager()
    extraction_method = "unknown"
    text_length = len(raw_text)
    estimated_tokens = max(100, min(text_length // 4, 3000))  # Rough estimate: 1 token per 4 chars

    # PRIMARY PATH: AI extraction directly from raw text
    if km.has_keys():
        try:
            logger.info(f"==> [CV Parser] Attempting AI-first extraction from raw text ({text_length} chars)...")
            ai_result = await extract_cv_with_hf(raw_text, job_title=job_title, user_id=user_id)
            if ai_result:
                logger.info(
                    f"==> [CV Parser] ✓ AI extraction succeeded: "
                    f"{len(ai_result.get('experience', []))} experiences, "
                    f"{len(ai_result.get('education', []))} education, "
                    f"{len(ai_result.get('skills', []))} skills."
                )
                extraction_method = "ai_extraction"
                return ai_result
            else:
                logger.warning("==> [CV Parser] AI extraction returned None, falling back to heuristic parser.")
                extraction_method = "fallback_after_ai_fail"
        except Exception as e:
            logger.warning(f"==> [CV Parser] AI extraction failed with error: {e}. Falling back to heuristic parser.")
            extraction_method = "fallback_after_ai_error"
    else:
        logger.info("==> [CV Parser] No HF API keys configured, using heuristic fallback parser.")
        extraction_method = "fallback_no_keys"

    # FALLBACK: Improved heuristic parser (only when AI is unavailable)
    logger.info(f"==> [CV Parser] Using heuristic fallback parser (method: {extraction_method}).")
    result = fallback_cv_parser(raw_text)
    
    # Log fallback usage to track that extraction happened
    try:
        await log_ai_usage(
            user_id=user_id,
            feature="cv_extraction",
            model="fallback_heuristic_parser",
            input_tokens=estimated_tokens,
            output_tokens=0,
            total_tokens=estimated_tokens,
            response_time_ms=0,
            status="success_via_fallback",
            api_key_hint="fallback",
            error_message=f"Used {extraction_method} parser",
        )
        logger.debug(f"==> [CV Parser] Logged fallback usage: {extraction_method}")
    except Exception as log_err:
        logger.warning(f"==> [CV Parser] Failed to log fallback usage: {log_err}")
    
    return result


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
        r"(?:PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT\s+HISTORY|CAREER\s+HISTORY)\s*\n([\s\S]*?)(?=\n\s*(?:EDUCATION|ACADEMIC|SKILLS|PROJECTS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|CORE\s+SKILLS|TRAINING|OPEN-SOURCE|$))",
        re.IGNORECASE
    )
    exp_match = exp_section_pattern.search(raw_text)
    if exp_match:
        exp_text = exp_match.group(1)
        exp_lines = exp_text.strip().splitlines()

        current_entry = None
        current_bullets = []

        for line in exp_lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Improved header detection: Look for "Company | Position" with optional "(Type)" and date range
            # Pattern: "Company | Position (Type/Remote) Start – End" or "Company | Position Start – End"
            date_range_match = re.search(
                r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4}|\d{1,2}/\d{1,2}/\d{4}|\d{4})\s*[-–—]\s*(Present|Current|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4}|\d{1,2}/\d{1,2}/\d{4}|\d{4})",
                stripped, re.IGNORECASE
            )
            
            # Check if this is a header line (has pipe separator or date range, and is not a bullet)
            has_pipe = "|" in stripped and not stripped.startswith("-")
            is_header = (date_range_match and not stripped.startswith("-")) or (has_pipe and len(stripped) < 200 and not stripped.startswith("-"))

            if is_header and len(stripped) > 10:
                # Save previous entry
                if current_entry:
                    current_entry["achievements"] = current_bullets
                    if current_entry["company"] or current_entry["position"]:  # Only add if has meaningful data
                        experiences.append(current_entry)
                    current_bullets = []

                # Parse header line
                company = ""
                position = ""
                location = ""
                start_date = ""
                end_date = ""
                is_current = False
                emp_type = "Full-time"

                # Extract date range first
                if date_range_match:
                    start_date = date_range_match.group(1)
                    end_date = date_range_match.group(2)
                    if end_date.lower() in ("present", "current"):
                        is_current = True
                    header_text = stripped[:date_range_match.start()].strip()
                else:
                    header_text = stripped

                # Parse company | position | location format
                parts = [p.strip() for p in header_text.split("|") if p.strip()]
                
                if len(parts) >= 2:
                    company = parts[0]
                    # Extract position and employment type from position field
                    pos_text = parts[1]
                    # Look for employment type in parentheses
                    type_match = re.search(r"\((Remote|Contractual|Contract|Part-time|Full-time|Internship|Temporary)\)", pos_text, re.IGNORECASE)
                    if type_match:
                        emp_type = type_match.group(1)
                        position = pos_text[:type_match.start()].strip()
                    else:
                        position = pos_text
                    location = parts[2] if len(parts) > 2 else ""
                elif len(parts) == 1:
                    company = parts[0]

                current_entry = {
                    "company": company,
                    "position": position,
                    "location": location,
                    "employment_type": emp_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_current": is_current,
                    "description": "",
                    "achievements": [],
                }
            elif stripped.startswith("-") or stripped.startswith("•") or stripped.startswith("*"):
                # Extract bullet point
                bullet = re.sub(r"^[-•*\s]+", "", stripped).strip()
                if len(bullet) > 10 and current_entry is not None:
                    current_bullets.append(bullet)

        # Don't forget the last entry
        if current_entry:
            current_entry["achievements"] = current_bullets
            if current_entry["company"] or current_entry["position"]:
                experiences.append(current_entry)

    # If section parsing found nothing, create fallback from action bullets
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
        r"(?:EDUCATION|ACADEMIC|QUALIFICATIONS|DEGREES)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|SKILLS|PROJECTS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|PROFESSIONAL|CORE\s+SKILLS|TRAINING|OPEN-SOURCE|LANGUAGES|HOBBIES|$))",
        re.IGNORECASE
    )
    edu_match = edu_section_pattern.search(raw_text)
    if edu_match:
        edu_text = edu_match.group(1).strip()
        edu_lines = [l.strip() for l in edu_text.splitlines() if l.strip()]
        
        current_edu = None
        for i, line in enumerate(edu_lines):
            # Look for date range (year patterns)
            date_match = re.search(
                r"(\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4})\s*[-–—]\s*(Present|Current|\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4})",
                line, re.IGNORECASE
            )
            # Look for GPA/CGPA
            gpa_match = re.search(r"(?:GPA|CGPA)[:\s]*(\d+\.?\d*)", line, re.IGNORECASE)
            
            # Header detection: pipe-separated or contains degree keywords or year
            degree_keywords = r"(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?B\.?A\.?|B\.?Tech\.?|M\.?Tech\.?|Bachelor|Master|Diploma|Associate|Intermediate|Matriculation)"
            has_degree_keyword = re.search(degree_keywords, line, re.IGNORECASE)
            has_pipe = "|" in line and not line.startswith("-")
            has_year = re.search(r"\d{4}", line)  # Just contains a year
            is_header = (date_match and not line.startswith("-")) or (has_degree_keyword and not line.startswith("-")) or (has_pipe and len(line) < 200 and not line.startswith("-")) or (has_year and (has_degree_keyword or has_pipe))

            if is_header and len(line) > 8:
                # Save previous education entry
                if current_edu:
                    education.append(current_edu)

                # Parse education header
                institution = ""
                degree = ""
                field = ""
                start_date = ""
                end_date = ""
                is_current_edu = False

                if date_match:
                    start_date = date_match.group(1)
                    end_date = date_match.group(2)
                    if end_date.lower() in ("present", "current"):
                        is_current_edu = True
                    # Remove date from line for parsing institution/degree
                    header_text = line[:date_match.start()].strip()
                else:
                    header_text = line

                # Split by pipe for "Institution | Degree | Field" format
                parts = [p.strip() for p in header_text.split("|") if p.strip()]
                
                if len(parts) >= 1:
                    institution = parts[0]
                if len(parts) >= 2:
                    degree = parts[1]
                if len(parts) >= 3:
                    field = parts[2]
                
                # If only one part and it contains both institution and degree keywords, try to split
                if len(parts) == 1 and re.search(degree_keywords, institution, re.IGNORECASE):
                    # Look for common patterns like "Institution, Degree" or "Institution - Degree"
                    comma_split = institution.split(",")
                    dash_split = institution.split(" - ")
                    
                    if len(comma_split) == 2:
                        institution = comma_split[0].strip()
                        degree = comma_split[1].strip()
                    elif len(dash_split) == 2:
                        institution = dash_split[0].strip()
                        degree = dash_split[1].strip()
                
                # If degree not found yet but next line looks like degree info, grab it
                if not degree and i + 1 < len(edu_lines):
                    next_line = edu_lines[i + 1]
                    if re.search(degree_keywords, next_line, re.IGNORECASE) and not re.search(r"^\d{4}", next_line):
                        # Next line looks like degree info
                        degree_parts = next_line.split("|")
                        degree = degree_parts[0].strip()
                        if len(degree_parts) > 1:
                            field = degree_parts[1].strip()

                current_edu = {
                    "institution": institution,
                    "degree": degree,
                    "field_of_study": field,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_current": is_current_edu,
                    "gpa": gpa_match.group(1) if gpa_match else "",
                    "description": "",
                }
            elif current_edu:
                # Handle continuation lines for current education entry
                if gpa_match and not current_edu.get("gpa"):
                    current_edu["gpa"] = gpa_match.group(1)
                # Check if this line looks like degree info (for next-line degree pattern)
                if not current_edu.get("degree") and re.search(degree_keywords, line, re.IGNORECASE):
                    degree_parts = line.split("|")
                    current_edu["degree"] = degree_parts[0].strip()
                    if len(degree_parts) > 1:
                        current_edu["field_of_study"] = degree_parts[1].strip()

        if current_edu:
            education.append(current_edu)

    # ── Skills Extraction (from dedicated section + full text scan) ──
    common_skills = [
        "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "FastAPI",
        "Django", "Flask", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker",
        "Kubernetes", "AWS", "GCP", "Azure", "Git", "CI/CD", "REST APIs", "GraphQL",
        "Machine Learning", "Deep Learning", "NLP", "LLMs", "RAG", "Data Analysis",
        "HTML", "CSS", "TailwindCSS", "C++", "Java", "Go", "Rust", "Linux", "Microservices",
        "PyTorch", "TensorFlow", "FAISS", "Computer Vision", "Predictive Modeling",
        "Bootstrap", "jQuery", "PHP", "Firebase", "MSSQL", "XML", "UML",
        "Java Swing", "Jupyter", "VS Code", "GitHub", "Cursor", "PyCharm",
        "Agile", "Scrum", "OOP", "Data Structures", "Algorithms", "Pandas", "NumPy", "Scikit-learn",
        "Jupyter", "Google Colab", "Keras", "OpenCV", "FAISS", "LangChain", "Hugging Face",
    ]
    
    detected_skills = []
    
    # First, try to extract from SKILLS or CORE SKILLS section
    skills_section_pattern = re.compile(
        r"(?:CORE\s+SKILLS|TECHNICAL\s+SKILLS|SKILLS|TECHNICAL\s+PROFICIENCIES)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATIONS|LANGUAGES|HOBBIES|REFERENCES|$))",
        re.IGNORECASE
    )
    skills_match = skills_section_pattern.search(raw_text)
    
    if skills_match:
        skills_text = skills_match.group(1)
        # Extract skills from dedicated section (look for comma/semicolon separated skills)
        # Remove bullets and clean up
        skills_text = re.sub(r"^[-•*\s]+", "", skills_text, flags=re.MULTILINE)
        # Split by common delimiters
        skill_items = re.split(r"[,;|]|\s+and\s+", skills_text, flags=re.IGNORECASE)
        for item in skill_items:
            cleaned = item.strip()
            if cleaned and len(cleaned) > 1 and len(cleaned) < 100:
                # Check if this item is in our common_skills list
                for skill in common_skills:
                    if skill.lower() in cleaned.lower():
                        if skill not in detected_skills:
                            detected_skills.append(skill)
                        break
                # Also add custom skills not in the predefined list
                if len(detected_skills) < 50 and cleaned not in detected_skills and len(cleaned) > 2:
                    # Only add if it looks like a valid skill (contains letters/digits)
                    if re.search(r"[a-zA-Z0-9]{2,}", cleaned):
                        # Check if not already added (case-insensitive)
                        if not any(s.lower() == cleaned.lower() for s in detected_skills):
                            detected_skills.append(cleaned)
    
    # Fall back to scanning full text for common skills
    if len(detected_skills) < 10:
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

