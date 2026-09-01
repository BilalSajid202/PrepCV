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
    text = re.sub(r"[•▪►●◆★✓✔■–—]", "-", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def convert_document_to_markdown(file_bytes: bytes, filename: str) -> str:
    """
    Convert uploaded document (PDF or DOCX) into clean, semantic Markdown (.md) representation:
    - Identifies main sections and applies Markdown H1 headers (# Section)
    - Identifies job/project/education sub-items (## Item)
    - Normalizes bullet points to standard Markdown lists (- Bullet)
    - Preserves tables as standard Markdown tables
    """
    lower_filename = filename.lower()
    raw_lines: List[str] = []

    if lower_filename.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                page_text = ""
                try:
                    page_text = page.extract_text(extraction_mode="layout")
                except Exception:
                    page_text = ""
                if not page_text or not page_text.strip():
                    page_text = page.extract_text() or ""
                if page_text.strip():
                    raw_lines.extend(page_text.splitlines())
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to read PDF file. Please ensure it is a valid, unencrypted PDF."
            )
    elif lower_filename.endswith(".docx"):
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                p_text = para.text.strip()
                if not p_text:
                    continue
                style_name = para.style.name.lower() if para.style else ""
                if "heading 1" in style_name:
                    raw_lines.append(f"# {p_text}")
                elif "heading 2" in style_name or "heading 3" in style_name:
                    raw_lines.append(f"## {p_text}")
                elif "bullet" in style_name or "list" in style_name:
                    raw_lines.append(f"- {p_text}")
                else:
                    if para.runs and all(r.bold for r in para.runs if r.text.strip()):
                        raw_lines.append(f"## {p_text}")
                    else:
                        raw_lines.append(p_text)

            for table in doc.tables:
                table_rows = []
                for row in table.rows:
                    cells = [c.text.strip() for c in row.cells if c.text.strip()]
                    unique_cells = []
                    for c in cells:
                        if not unique_cells or c != unique_cells[-1]:
                            unique_cells.append(c)
                    if unique_cells:
                        table_rows.append(unique_cells)
                if table_rows:
                    header = table_rows[0]
                    raw_lines.append("")
                    raw_lines.append("| " + " | ".join(header) + " |")
                    raw_lines.append("| " + " | ".join(["---"] * len(header)) + " |")
                    for row in table_rows[1:]:
                        padded = row + [""] * (len(header) - len(row))
                        raw_lines.append("| " + " | ".join(padded[:len(header)]) + " |")
                    raw_lines.append("")
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

    # Convert lines to clean semantic Markdown
    md_lines: List[str] = []
    section_keywords = {
        "summary": "PROFESSIONAL SUMMARY",
        "professional summary": "PROFESSIONAL SUMMARY",
        "about me": "ABOUT ME",
        "profile": "PROFESSIONAL SUMMARY",
        "objective": "CAREER OBJECTIVE",
        "work experience": "WORK EXPERIENCE",
        "professional experience": "WORK EXPERIENCE",
        "experience": "WORK EXPERIENCE",
        "employment history": "WORK EXPERIENCE",
        "projects": "PROJECTS",
        "key projects": "PROJECTS",
        "personal projects": "PROJECTS",
        "academic projects": "PROJECTS",
        "selected projects": "PROJECTS",
        "education": "EDUCATION",
        "academic background": "EDUCATION",
        "skills": "SKILLS",
        "core skills": "SKILLS",
        "technical skills": "SKILLS",
        "certifications": "CERTIFICATIONS",
        "certificates": "CERTIFICATIONS",
        "licenses & certifications": "CERTIFICATIONS",
        "courses": "CERTIFICATIONS",
    }

    for line in raw_lines:
        line_clean = re.sub(r"[ \t]+", " ", line)
        stripped = line_clean.strip()
        if not stripped:
            continue

        if stripped.startswith("#"):
            md_lines.append(f"\n{stripped}\n")
            continue

        clean_lower = stripped.lower().rstrip(":")

        if clean_lower in section_keywords:
            section_title = section_keywords[clean_lower]
            md_lines.append(f"\n# {section_title}\n")
            continue

        if re.match(r"^[-•*–—►▪●◆★✔■]\s*", stripped):
            clean_bullet = re.sub(r"^[-•*–—►▪●◆★✔■]\s*", "", stripped).strip()
            if clean_bullet:
                md_lines.append(f"- {clean_bullet}")
            continue

        if "|" in stripped:
            parts = [p.strip() for p in stripped.split("|") if p.strip()]
            if len(parts) >= 2:
                if any(re.search(r"\d{4}|present|developer|engineer|manager|lead|intern|university|college|inc|llc|ltd", p, re.I) for p in parts):
                    md_lines.append(f"\n## {' | '.join(parts)}")
                    continue

        md_lines.append(stripped)

    md_document = "\n".join(md_lines)
    md_document = re.sub(r"\n{3,}", "\n\n", md_document).strip()

    if not md_document or len(md_document) < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file contains no extractable text. Please ensure it is a valid document with selectable text."
        )

    return md_document


def extract_raw_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Extract and convert document to clean Markdown format."""
    return convert_document_to_markdown(file_bytes, filename)


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
    result = fallback_cv_parser(raw_text, job_title=job_title)
    
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


# Common soft skills to filter out from technical proficiencies
SOFT_SKILLS_KEYWORDS = {
    "communication", "interpersonal", "teamwork", "collaboration", "organizational",
    "time management", "problem-solving", "attention to detail", "leadership",
    "project management", "critical thinking", "analytical", "creative thinking",
    "adaptability", "flexibility", "reliability", "accountability", "initiative",
    "presentation", "public speaking", "negotiation", "conflict resolution",
    "customer service", "client management", "stakeholder management", "ms office",
    "word", "excel", "powerpoint", "event coordination", "event management",
    "recruitment", "recruiting", "hiring", "onboarding", "training",
    "mentoring", "coaching", "employee relations", "hr", "human resources",
    "networking", "relationship building", "multitasking", "prioritization"
}

def categorize_skills(skills_list: list[str]) -> tuple[list[str], list[str]]:
    """Separate technical skills from soft/professional skills."""
    technical_skills = []
    soft_skills = []
    
    for skill in skills_list:
        skill_lower = skill.lower().strip()
        # Check if skill is in soft skills keywords
        is_soft_skill = False
        for soft_keyword in SOFT_SKILLS_KEYWORDS:
            if soft_keyword in skill_lower or skill_lower in soft_keyword:
                is_soft_skill = True
                break
        
        if is_soft_skill:
            soft_skills.append(skill)
        else:
            technical_skills.append(skill)
    
    return technical_skills, soft_skills


def fallback_cv_parser(raw_text: str, job_title: str = "") -> Dict[str, Any]:
    """
    Improved heuristic parser that extracts structured data from raw CV text.
    Used ONLY as a last-resort fallback when all AI extraction paths fail.
    Attempts section-aware parsing to extract multiple experience/education entries.
    Optionally prioritizes skills relevant to the target job_title if provided.
    """
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    # ── Extract Contact Information ──
    email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", raw_text)
    phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,7}", raw_text)
    linkedin_match = re.search(r"linkedin\.com/in/[a-zA-Z0-9_-]+", raw_text)
    github_match = re.search(r"github\.com/[a-zA-Z0-9_-]+", raw_text)
    portfolio_match = re.search(r"(?:portfolio|website)[:\s]*(https?://[^\s]+)", raw_text, re.IGNORECASE)

    # ── Candidate Name (first line that isn't an email or link) ──
    full_name = ""
    for line in lines[:5]:
        clean_l = re.sub(r"^[#\s*]+|[*]+$", "", line).strip()
        if clean_l and not re.search(r"@|linkedin|github|http|\.com|\+?\d{7,}", clean_l, re.IGNORECASE) and len(clean_l) < 50:
            full_name = clean_l
            break

    # ── Professional Title (line after name, usually contains job title keywords) ──
    professional_title = ""
    title_keywords = r"(?:engineer|developer|designer|analyst|manager|consultant|architect|scientist|lecturer|teacher|assistant|intern|lead|senior|junior|full.?stack|front.?end|back.?end|devops|data|machine.?learning|ai|ml|software)"
    for line in lines[1:6]:
        clean_t = re.sub(r"^[#\s*]+|[*]+$", "", line).strip()
        if re.search(title_keywords, clean_t, re.IGNORECASE) and len(clean_t) < 120:
            professional_title = clean_t
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
        # Clean line breaks and multi-space indentation within summary paragraphs
        summary_text = re.sub(r"\n(?!\n)", " ", summary_text)
        summary_text = re.sub(r"[ \t]+", " ", summary_text)
        summary_text = re.sub(r"(\w+)\s+-\s*([a-z]+)", r"\1-\2", summary_text)
        for para in summary_text.split("\n\n"):
            clean_para = para.strip()
            if len(clean_para) > 30:
                summary = clean_para
                break

    # ── Experience Extraction (section-aware & format-agnostic) ──
    experiences = []
    exp_section_pattern = re.compile(
        r"(?:PROFESSIONAL\s+EXPERIENCE|WORK\s+EXPERIENCE|EXPERIENCE|EMPLOYMENT\s+HISTORY|CAREER\s+HISTORY)\s*\n([\s\S]*?)(?=\n\s*(?:EDUCATION|ACADEMIC|SKILLS|PROJECTS|KEY\s+PROJECTS|PERSONAL\s+PROJECTS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|CORE\s+SKILLS|TECHNICAL\s+SKILLS|TRAINING|OPEN-SOURCE|$))",
        re.IGNORECASE
    )
    exp_match = exp_section_pattern.search(raw_text)
    if exp_match:
        exp_text = exp_match.group(1)
        exp_lines = exp_text.strip().splitlines()

        current_entry = None
        current_bullets = []

        date_regex = re.compile(
            r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}/\d{1,2}/\d{4}|\d{4})\s*[-–—/to\s]+\s*(Present|Current|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}/\d{1,2}/\d{4}|\d{4})",
            re.IGNORECASE
        )

        for line in exp_lines:
            stripped = line.strip()
            if not stripped:
                continue

            date_range_match = date_regex.search(stripped)
            is_bullet = stripped.startswith("-") or stripped.startswith("•") or stripped.startswith("*") or stripped.startswith("–")
            
            # Header line detection
            has_pipe = "|" in stripped and not is_bullet
            has_at = re.search(r"\b(?:at|@)\b", stripped, re.I) and not is_bullet
            has_date = bool(date_range_match) and not is_bullet

            is_new_entry = False
            if (has_date or has_pipe or has_at) and not is_bullet and len(stripped) > 5 and len(stripped) < 200:
                is_new_entry = True

            if is_new_entry:
                if current_entry:
                    current_entry["achievements"] = current_bullets
                    if current_entry["company"] or current_entry["position"]:
                        experiences.append(current_entry)
                    current_bullets = []

                start_date = ""
                end_date = ""
                is_current = False
                header_text = stripped

                if date_range_match:
                    start_date = date_range_match.group(1).strip()
                    end_date = date_range_match.group(2).strip()
                    if end_date.lower() in ("present", "current"):
                        is_current = True
                    header_text = (stripped[:date_range_match.start()] + " " + stripped[date_range_match.end():]).strip()

                company = ""
                position = ""
                location = ""
                emp_type = "Full-time"

                # Check for employment type in parentheses
                type_match = re.search(r"\((Remote|Contractual|Contract|Part-time|Full-time|Internship|Temporary|Hybrid)\)", header_text, re.I)
                if type_match:
                    emp_type = type_match.group(1)
                    header_text = header_text[:type_match.start()].strip() + " " + header_text[type_match.end():].strip()

                if "|" in header_text:
                    parts = [p.strip() for p in header_text.split("|") if p.strip()]
                    if len(parts) >= 2:
                        company = parts[0]
                        position = parts[1]
                        if len(parts) > 2:
                            location = parts[2]
                    elif len(parts) == 1:
                        company = parts[0]
                elif re.search(r"\b(?:at|@)\b", header_text, re.I):
                    at_parts = re.split(r"\b(?:at|@)\b", header_text, flags=re.I)
                    position = at_parts[0].strip()
                    company = at_parts[1].strip() if len(at_parts) > 1 else ""
                elif " - " in header_text:
                    dash_parts = [p.strip() for p in header_text.split(" - ") if p.strip()]
                    if len(dash_parts) >= 2:
                        company = dash_parts[0]
                        position = dash_parts[1]
                    else:
                        company = dash_parts[0]
                elif "," in header_text:
                    comma_parts = [p.strip() for p in header_text.split(",") if p.strip()]
                    if len(comma_parts) >= 2:
                        position = comma_parts[0]
                        company = comma_parts[1]
                    else:
                        company = comma_parts[0]
                else:
                    company = header_text

                current_entry = {
                    "company": company,
                    "position": position or "Professional",
                    "location": location,
                    "employment_type": emp_type,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_current": is_current,
                    "description": "",
                    "achievements": [],
                }
            elif is_bullet:
                bullet = re.sub(r"^[-•*–\s]+", "", stripped).strip()
                if len(bullet) > 8 and current_entry is not None:
                    current_bullets.append(bullet)
            elif current_entry and not current_entry.get("position") and len(stripped) < 80:
                current_entry["position"] = stripped

        if current_entry:
            current_entry["achievements"] = current_bullets
            if current_entry["company"] or current_entry["position"]:
                experiences.append(current_entry)

    # ── Education Extraction ──
    education = []
    edu_section_pattern = re.compile(
        r"(?:EDUCATION|ACADEMIC|QUALIFICATIONS|DEGREES)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|SKILLS|PROJECTS|KEY\s+PROJECTS|PERSONAL\s+PROJECTS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|PROFESSIONAL|CORE\s+SKILLS|TECHNICAL\s+SKILLS|TRAINING|OPEN-SOURCE|LANGUAGES|HOBBIES|$))",
        re.IGNORECASE
    )
    edu_match = edu_section_pattern.search(raw_text)
    if edu_match:
        edu_text = edu_match.group(1).strip()
        edu_lines = [l.strip() for l in edu_text.splitlines() if l.strip()]
        
        current_edu = None
        for i, line in enumerate(edu_lines):
            date_match = re.search(
                r"(\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4})\s*[-–—/to\s]+\s*(Present|Current|\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4})",
                line, re.IGNORECASE
            )
            gpa_match = re.search(r"(?:GPA|CGPA)[:\s]*(\d+\.?\d*)", line, re.IGNORECASE)
            
            degree_keywords = r"(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?B\.?A\.?|B\.?Tech\.?|M\.?Tech\.?|Bachelor|Master|Diploma|Associate|Intermediate|Matriculation|Ph\.?D\.?|Doctorate)"
            has_degree_keyword = re.search(degree_keywords, line, re.IGNORECASE)
            has_pipe = "|" in line and not line.startswith("-")
            has_year = re.search(r"\d{4}", line)
            is_header = (date_match and not line.startswith("-")) or (has_degree_keyword and not line.startswith("-")) or (has_pipe and len(line) < 200 and not line.startswith("-")) or (has_year and (has_degree_keyword or has_pipe))

            if is_header and len(line) > 6:
                if current_edu:
                    education.append(current_edu)

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
                    header_text = line[:date_match.start()].strip()
                else:
                    header_text = line

                parts = [p.strip() for p in header_text.split("|") if p.strip()]
                if len(parts) >= 1:
                    institution = parts[0]
                if len(parts) >= 2:
                    degree = parts[1]
                if len(parts) >= 3:
                    field = parts[2]
                
                if len(parts) == 1 and re.search(degree_keywords, institution, re.IGNORECASE):
                    comma_split = institution.split(",")
                    dash_split = institution.split(" - ")
                    if len(comma_split) == 2:
                        institution = comma_split[0].strip()
                        degree = comma_split[1].strip()
                    elif len(dash_split) == 2:
                        institution = dash_split[0].strip()
                        degree = dash_split[1].strip()
                
                if not degree and i + 1 < len(edu_lines):
                    next_line = edu_lines[i + 1]
                    if re.search(degree_keywords, next_line, re.IGNORECASE) and not re.search(r"^\d{4}", next_line):
                        degree_parts = next_line.split("|")
                        degree = degree_parts[0].strip()
                        if len(degree_parts) > 1:
                            field = degree_parts[1].strip()

                current_edu = {
                    "institution": institution,
                    "degree": degree or "Degree",
                    "field_of_study": field,
                    "start_date": start_date,
                    "end_date": end_date,
                    "is_current": is_current_edu,
                    "gpa": gpa_match.group(1) if gpa_match else "",
                    "description": "",
                }
            elif current_edu:
                if gpa_match and not current_edu.get("gpa"):
                    current_edu["gpa"] = gpa_match.group(1)
                if not current_edu.get("degree") and re.search(degree_keywords, line, re.IGNORECASE):
                    degree_parts = line.split("|")
                    current_edu["degree"] = degree_parts[0].strip()
                    if len(degree_parts) > 1:
                        current_edu["field_of_study"] = degree_parts[1].strip()

        if current_edu:
            education.append(current_edu)

    # ── Projects Extraction (format-agnostic) ──
    projects = []
    proj_section_pattern = re.compile(
        r"(?:KEY\s+PROJECTS|PERSONAL\s+PROJECTS|ACADEMIC\s+PROJECTS|PORTFOLIO\s+PROJECTS|SELECTED\s+PROJECTS|PROJECTS)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|SKILLS|CERTIFICATIONS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|CORE\s+SKILLS|TECHNICAL\s+SKILLS|TRAINING|OPEN-SOURCE|LANGUAGES|HOBBIES|$))",
        re.IGNORECASE
    )
    proj_match = proj_section_pattern.search(raw_text)
    if proj_match:
        proj_text = proj_match.group(1).strip()
        proj_lines = proj_text.splitlines()

        current_proj = None
        current_proj_bullets = []

        for line in proj_lines:
            stripped = line.strip()
            if not stripped:
                continue

            is_bullet = stripped.startswith("-") or stripped.startswith("•") or stripped.startswith("*") or stripped.startswith("–")
            
            # Check for project header: non-bullet, short to medium length, may have tech stack or links
            is_proj_header = not is_bullet and len(stripped) < 140 and not stripped.lower().startswith("tech") and not stripped.lower().startswith("built with")

            if is_proj_header and len(stripped) > 3:
                if current_proj:
                    current_proj["achievements"] = current_proj_bullets
                    if not current_proj["description"] and current_proj_bullets:
                        current_proj["description"] = " ".join(current_proj_bullets[:2])
                    projects.append(current_proj)
                    current_proj_bullets = []

                proj_name = stripped
                tech_list = []
                github_url = ""
                proj_url = ""

                # Extract technologies from header if formatted like "Project Name | Python, FastAPI, React"
                if "|" in stripped:
                    parts = [p.strip() for p in stripped.split("|") if p.strip()]
                    proj_name = parts[0]
                    if len(parts) > 1:
                        raw_techs = parts[1]
                        tech_list = [t.strip() for t in re.split(r"[,;/]", raw_techs) if t.strip()]

                # Extract links if present
                gh_match = re.search(r"github\.com/[^\s)]+", stripped, re.I)
                if gh_match:
                    github_url = f"https://{gh_match.group(0)}"
                url_match = re.search(r"https?://[^\s)]+", stripped, re.I)
                if url_match and "github.com" not in url_match.group(0):
                    proj_url = url_match.group(0)

                current_proj = {
                    "name": proj_name,
                    "description": "",
                    "technologies": tech_list,
                    "project_url": proj_url,
                    "github_url": github_url,
                    "achievements": [],
                }
            elif current_proj:
                # Check for tech stack line like "Technologies: Python, React, PostgreSQL"
                tech_match = re.search(r"(?:Tech(?:nologies)?|Stack|Built with)[:\s]+(.+)", stripped, re.I)
                if tech_match:
                    raw_techs = tech_match.group(1)
                    extracted_techs = [t.strip() for t in re.split(r"[,;|/]", raw_techs) if t.strip()]
                    current_proj["technologies"].extend(extracted_techs)
                elif is_bullet:
                    clean_bullet = re.sub(r"^[-•*–\s]+", "", stripped).strip()
                    if len(clean_bullet) > 8:
                        current_proj_bullets.append(clean_bullet)
                elif len(stripped) > 20 and not current_proj["description"]:
                    current_proj["description"] = stripped

        if current_proj:
            current_proj["achievements"] = current_proj_bullets
            if not current_proj["description"] and current_proj_bullets:
                current_proj["description"] = " ".join(current_proj_bullets[:2])
            projects.append(current_proj)

    # ── Certifications Extraction ──
    certifications = []
    cert_section_pattern = re.compile(
        r"(?:CERTIFICATIONS|LICENSES\s+&\s+CERTIFICATIONS|CERTIFICATES|COURSES\s+&\s+CERTIFICATIONS)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|SKILLS|PROJECTS|PUBLICATIONS|RESEARCH|AWARDS|INTERESTS|REFERENCES|CORE\s+SKILLS|TECHNICAL\s+SKILLS|TRAINING|OPEN-SOURCE|LANGUAGES|HOBBIES|$))",
        re.IGNORECASE
    )
    cert_match = cert_section_pattern.search(raw_text)
    if cert_match:
        cert_text = cert_match.group(1).strip()
        for line in cert_text.splitlines():
            stripped = re.sub(r"^[-•*–\s]+", "", line).strip()
            if not stripped or len(stripped) < 4:
                continue
            
            date_match = re.search(r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{4}|\d{4})", stripped, re.I)
            issue_date = date_match.group(1) if date_match else ""
            
            cert_name = stripped
            issuer = ""
            if "|" in stripped:
                parts = [p.strip() for p in stripped.split("|") if p.strip()]
                cert_name = parts[0]
                if len(parts) > 1:
                    issuer = parts[1]
            elif " - " in stripped:
                parts = [p.strip() for p in stripped.split(" - ") if p.strip()]
                cert_name = parts[0]
                if len(parts) > 1:
                    issuer = parts[1]

            certifications.append({
                "name": cert_name,
                "issuing_organization": issuer or "Accredited Organization",
                "issue_date": issue_date,
                "expiration_date": "",
                "credential_id": "",
                "credential_url": "",
            })

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
        "Google Colab", "Keras", "OpenCV", "LangChain", "Hugging Face",
    ]
    
    detected_skills = []
    
    skills_section_pattern = re.compile(
        r"(?:CORE\s+SKILLS|TECHNICAL\s+SKILLS|SKILLS|TECHNICAL\s+PROFICIENCIES)\s*\n([\s\S]*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATIONS|LANGUAGES|HOBBIES|REFERENCES|$))",
        re.IGNORECASE
    )
    skills_match = skills_section_pattern.search(raw_text)
    
    if skills_match:
        skills_text = skills_match.group(1)
        skills_text = re.sub(r"^[-•*\s]+", "", skills_text, flags=re.MULTILINE)
        skill_items = re.split(r"[,;|]|\s+and\s+", skills_text, flags=re.IGNORECASE)
        for item in skill_items:
            cleaned = item.strip()
            if cleaned and len(cleaned) > 1 and len(cleaned) < 100:
                for skill in common_skills:
                    if skill.lower() in cleaned.lower():
                        if skill not in detected_skills:
                            detected_skills.append(skill)
                        break
                if len(detected_skills) < 50 and cleaned not in detected_skills and len(cleaned) > 2:
                    if re.search(r"[a-zA-Z0-9]{2,}", cleaned):
                        if not any(s.lower() == cleaned.lower() for s in detected_skills):
                            detected_skills.append(cleaned)
    
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
        "projects": projects,
        "certifications": certifications,
    }

