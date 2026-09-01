import json
import logging
import re
from typing import Dict, Any, List, Optional, Set, Tuple

from app.core.config import get_settings
from app.integrations.huggingface.client import _call_hf_json_api, get_hf_key_manager

logger = logging.getLogger(__name__)

# Common industry tech and domain skills dictionary for robust fallback & NLP extraction
KNOWN_SKILLS_LEXICON = [
    # Languages & Runtimes
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Golang", "Rust", "PHP", "Ruby", "Swift", "Kotlin", "Scala", "R", "SQL", "HTML", "CSS", "Bash", "Shell",
    # Frameworks & Libraries
    "FastAPI", "Django", "Flask", "React", "React.js", "Next.js", "Vue.js", "Vue", "Angular", "Node.js", "Express.js", "Express", "Spring Boot", "Spring", ".NET", "ASP.NET", "Laravel", "Tailwind CSS", "Bootstrap", "Redux", "GraphQL", "REST", "RESTful", "REST APIs", "gRPC", "PyTorch", "TensorFlow", "Keras", "Scikit-Learn", "Pandas", "NumPy", "OpenCV", "LangChain", "LlamaIndex", "HuggingFace", "Transformers",
    # Databases & Storage
    "PostgreSQL", "Postgres", "MySQL", "MongoDB", "Redis", "SQLite", "Cassandra", "DynamoDB", "Elasticsearch", "Neo4j", "Qdrant", "Pinecone", "Milvus", "ChromaDB", "Oracle", "SQL Server", "Snowflake", "BigQuery",
    # Cloud & DevOps
    "AWS", "Amazon Web Services", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "K8s", "Terraform", "Ansible", "CI/CD", "GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "Linux", "Nginx", "Apache", "Helm", "Prometheus", "Grafana", "Datadog",
    # Concepts & Methodologies
    "Machine Learning", "Deep Learning", "Artificial Intelligence", "AI", "NLP", "Natural Language Processing", "Computer Vision", "LLM", "LLMs", "RAG", "Retrieval-Augmented Generation", "Generative AI", "Microservices", "Event-Driven Architecture", "System Design", "Agile", "Scrum", "Test-Driven Development", "TDD", "Clean Code", "OOP", "Object-Oriented Programming", "API Integration", "WebSockets", "Data Pipelines", "ETL",
    # Management & Soft Skills
    "Leadership", "Team Mentorship", "Cross-Functional Collaboration", "Problem Solving", "Strategic Planning", "Project Management", "Technical Writing", "Code Review"
]


def _normalize_text(text: str) -> str:
    """Normalize text for consistent keyword comparison."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.lower().strip())


def _extract_all_resume_text(content: Dict[str, Any]) -> str:
    """Collect all searchable text across summary, experience, education, skills, projects, and certs."""
    parts = []
    
    # Personal Info & Title
    pi = content.get("personal_info") or {}
    if pi.get("professional_title"):
        parts.append(str(pi["professional_title"]))
    if pi.get("summary"):
        parts.append(str(pi["summary"]))
    if content.get("summary"):
        parts.append(str(content["summary"]))
        
    # Skills
    for skill in (content.get("skills") or []):
        parts.append(str(skill))
        
    # Experience
    for exp in (content.get("experience") or []):
        if exp.get("position"): parts.append(str(exp["position"]))
        if exp.get("company"): parts.append(str(exp["company"]))
        if exp.get("description"): parts.append(str(exp["description"]))
        for ach in (exp.get("achievements") or []):
            parts.append(str(ach))
            
    # Education
    for edu in (content.get("education") or []):
        if edu.get("degree"): parts.append(str(edu["degree"]))
        if edu.get("field_of_study"): parts.append(str(edu["field_of_study"]))
        if edu.get("institution"): parts.append(str(edu["institution"]))
        if edu.get("description"): parts.append(str(edu["description"]))
        
    # Projects
    for proj in (content.get("projects") or []):
        if proj.get("name"): parts.append(str(proj["name"]))
        if proj.get("description"): parts.append(str(proj["description"]))
        for tech in (proj.get("technologies") or []):
            parts.append(str(tech))
        for ach in (proj.get("achievements") or []):
            parts.append(str(ach))
            
    # Certifications
    for cert in (content.get("certifications") or []):
        if cert.get("name"): parts.append(str(cert["name"]))
        if cert.get("issuing_organization"): parts.append(str(cert["issuing_organization"]))
        
    return " ".join(parts)


def _find_keyword_in_text(keyword: str, text: str) -> int:
    """Find occurrences of keyword in text using regex boundary matching."""
    norm_kw = re.escape(keyword.lower().strip())
    # Special character handling (e.g. C++, CI/CD, .NET)
    if keyword.endswith("+") or keyword.endswith("#") or "/" in keyword or "." in keyword:
        pattern = rf"(?:\b|\s|^){norm_kw}(?:\b|\s|$|[,\.;:\)])"
    else:
        pattern = rf"\b{norm_kw}\b"
    
    matches = re.findall(pattern, text.lower())
    return len(matches)


def _deterministic_ats_analysis(job_description: str, resume_content: Dict[str, Any]) -> Dict[str, Any]:
    """Perform fast, accurate deterministic keyword analysis and scoring."""
    jd_norm = _normalize_text(job_description)
    resume_text = _extract_all_resume_text(resume_content)
    resume_skills_set = {s.lower().strip() for s in (resume_content.get("skills") or [])}

    # 1. Identify relevant skills mentioned in JD
    jd_found_skills: List[Tuple[str, int]] = []
    for skill in KNOWN_SKILLS_LEXICON:
        count = _find_keyword_in_text(skill, jd_norm)
        if count > 0:
            jd_found_skills.append((skill, count))

    # Also extract potential capitalized keywords or multi-word terms from JD
    potential_terms = re.findall(r"\b[A-Z][a-zA-Z0-9_\+\#\.\/]{2,}\b", job_description)
    for term in set(potential_terms):
        if len(term) > 2 and term.lower() not in [s[0].lower() for s in jd_found_skills]:
            # Filter out common English stop words
            if term.lower() not in {"the", "and", "for", "with", "you", "our", "are", "will", "have", "this", "that", "from", "your", "must", "work", "join", "team", "year", "years", "role"}:
                c = _find_keyword_in_text(term, jd_norm)
                if c >= 2:  # mentioned multiple times
                    jd_found_skills.append((term, c))

    # Sort by frequency in JD
    jd_found_skills.sort(key=lambda x: x[1], reverse=True)

    if not jd_found_skills:
        # Fallback if JD didn't match known terms
        jd_found_skills = [("Core Competencies", 1), ("Professional Communication", 1)]

    # 2. Check each skill against resume
    matching_skills: List[str] = []
    missing_keywords: List[Dict[str, Any]] = []

    for skill, count in jd_found_skills:
        resume_count = _find_keyword_in_text(skill, resume_text)
        if resume_count > 0 or skill.lower() in resume_skills_set:
            matching_skills.append(skill)
        else:
            missing_keywords.append({
                "skill": skill,
                "count_in_jd": count,
                "section": "skills" if count > 1 else "experience"
            })

    total_jd_keywords = len(jd_found_skills)
    matched_count = len(matching_skills)
    
    # 3. Calculate scores
    keyword_match_pct = min(100, int((matched_count / max(1, total_jd_keywords)) * 100))
    
    # Skills match: proportion of explicit resume skills matching JD
    resume_skills_count = len(resume_content.get("skills") or [])
    skills_match_pct = min(100, int((matched_count / max(1, min(total_jd_keywords, 15))) * 95)) if total_jd_keywords > 0 else 70
    
    # Experience match: check if experience section has achievements with action metrics
    exp_list = resume_content.get("experience") or []
    has_metrics = False
    exp_word_count = 0
    for e in exp_list:
        desc = str(e.get("description", ""))
        for a in (e.get("achievements") or []):
            desc += " " + str(a)
        exp_word_count += len(desc.split())
        if re.search(r"\d+%|\$\d+|\d+\+|\b\d+\b\s*(?:users|clients|engineers|projects|ms|seconds)", desc):
            has_metrics = True
            
    experience_match_pct = 85 if (exp_word_count > 100 and has_metrics) else (70 if exp_word_count > 50 else 55)
    
    # Education match
    edu_list = resume_content.get("education") or []
    education_match_pct = 90 if len(edu_list) > 0 else 70

    # Overall weighted ATS score
    overall_score = int((keyword_match_pct * 0.40) + (skills_match_pct * 0.30) + (experience_match_pct * 0.20) + (education_match_pct * 0.10))
    overall_score = max(20, min(98, overall_score))

    # Score tier
    if overall_score >= 90:
        score_tier = "Excellent Match"
        score_summary = "Your resume is a top-tier match for this position with high keyword alignment."
    elif overall_score >= 75:
        score_tier = "Strong Match"
        score_summary = "Your resume is a strong match. Addressing key missing skills will boost ATS ranking."
    elif overall_score >= 50:
        score_tier = "Needs Improvement"
        score_summary = "Your resume matches foundational requirements but misses several high-frequency JD keywords."
    else:
        score_tier = "Low Match"
        score_summary = "Significant keyword gaps detected between the job requirements and your resume."

    # 4. Generate concrete, actionable recommendations (At least 3)
    recommendations: List[Dict[str, Any]] = []
    rec_id = 1

    # Recommendation 1 & 2: Missing high-frequency skills
    for item in missing_keywords[:3]:
        skill_name = item["skill"]
        count = item["count_in_jd"]
        times_str = f"{count} times" if count > 1 else "as a requirement"
        recommendations.append({
            "id": f"rec-{rec_id}",
            "title": f"Add '{skill_name}' (Mentioned {times_str} in JD)",
            "description": f"The job description highlights {skill_name}. Add it to your skills or experience section if you have relevant hands-on background.",
            "action_type": "add_skill",
            "target_text": skill_name,
            "category": "Skills"
        })
        rec_id += 1

    # Recommendation 3: Experience metric enhancement
    if not has_metrics and exp_list:
        recommendations.append({
            "id": f"rec-{rec_id}",
            "title": "Quantify experience with measurable metrics",
            "description": "ATS parsers and recruiters favor bullet points with quantifiable numbers (e.g. 'improved latency by 25%', 'managed 5 engineers').",
            "action_type": "edit_experience",
            "target_text": "experience",
            "category": "Impact"
        })
        rec_id += 1

    # Recommendation 4: Summary tailoring
    if not resume_content.get("summary") or len(str(resume_content.get("summary", "")).split()) < 20:
        recommendations.append({
            "id": f"rec-{rec_id}",
            "title": "Strengthen professional summary",
            "description": "Craft a 2–3 sentence summary targeted to the specific job title and top keywords from this JD.",
            "action_type": "edit_summary",
            "target_text": "summary",
            "category": "Summary"
        })
        rec_id += 1

    # Fallback to ensure at least 3 actionable recommendations
    while len(recommendations) < 3:
        recommendations.append({
            "id": f"rec-{rec_id}",
            "title": "Align bullet action verbs with role requirements",
            "description": "Start each experience achievement with active, high-impact verbs (e.g. 'Architected', 'Spearheaded', 'Engineered').",
            "action_type": "edit_experience",
            "target_text": "experience",
            "category": "Formatting"
        })
        rec_id += 1

    return {
        "overall_score": overall_score,
        "score_tier": score_tier,
        "score_summary": score_summary,
        "keyword_stats": {
            "matched_keywords_count": matched_count,
            "total_jd_keywords_count": total_jd_keywords,
        },
        "breakdown": {
            "keyword_match": keyword_match_pct,
            "skills_match": skills_match_pct,
            "experience_match": experience_match_pct,
            "education_match": education_match_pct,
        },
        "missing_keywords": missing_keywords[:12],
        "matching_skills": matching_skills[:20],
        "recommendations": recommendations[:6],
    }


async def score_resume_against_jd(job_description: str, resume_content: Dict[str, Any]) -> Dict[str, Any]:
    """
    Score resume against target job description using Hugging Face Qwen AI with fallback to deterministic NLP scoring.
    Complies with FR-8, FR-9, and NFR-10.
    """
    if not job_description or not job_description.strip():
        return {
            "overall_score": 0,
            "score_tier": "No Job Description",
            "score_summary": "Please paste a job description to calculate ATS compatibility.",
            "keyword_stats": {"matched_keywords_count": 0, "total_jd_keywords_count": 0},
            "breakdown": {"keyword_match": 0, "skills_match": 0, "experience_match": 0, "education_match": 0},
            "missing_keywords": [],
            "matching_skills": [],
            "recommendations": []
        }

    km = get_hf_key_manager()

    # Run deterministic scoring as baseline & fallback
    deterministic_result = _deterministic_ats_analysis(job_description, resume_content)

    if not km.has_keys():
        logger.info("Hugging Face API keys not configured – using deterministic ATS scoring engine.")
        return deterministic_result

    # If keys are available, call Hugging Face Qwen for enriched contextual analysis
    try:
        resume_summary_text = _extract_all_resume_text(resume_content)
        
        system_instruction = """You are an advanced ATS (Applicant Tracking System) parser and resume evaluation engine.
Analyze the candidate's resume content against the target Job Description.
Evaluate exact keyword matches, skill matches, experience relevance, and identify concrete gaps.

Return ONLY a JSON object matching this exact schema:
{
  "overall_score": 85,
  "score_tier": "Strong Match",
  "score_summary": "Your resume is a strong match for this position.",
  "keyword_stats": {
    "matched_keywords_count": 42,
    "total_jd_keywords_count": 48
  },
  "breakdown": {
    "keyword_match": 88,
    "skills_match": 85,
    "experience_match": 82,
    "education_match": 90
  },
  "missing_keywords": [
    {
      "skill": "Kubernetes",
      "count_in_jd": 3,
      "section": "skills"
    }
  ],
  "matching_skills": ["Python", "FastAPI", "PostgreSQL"],
  "recommendations": [
    {
      "id": "rec-1",
      "title": "Add 'Kubernetes' (Mentioned 3x in JD)",
      "description": "The JD highlights Kubernetes. Add if you have relevant experience.",
      "action_type": "add_skill",
      "target_text": "Kubernetes",
      "category": "Skills"
    }
  ]
}

CRITICAL RULES:
1. Ensure overall_score is between 0 and 100.
2. Provide at least 3 concrete, specific recommendations (not generic tips).
3. In recommendations, explicitly advise: 'Add if you have relevant experience' so candidates maintain resume authenticity.
"""

        user_payload = json.dumps({
            "job_description": job_description[:4000],
            "resume_text": resume_summary_text[:4000],
            "explicit_skills": resume_content.get("skills") or []
        })

        raw_response = await _call_hf_json_api(
            system_instruction=system_instruction,
            user_payload=user_payload,
            retry_count=1,
        )

        if raw_response:
            clean_json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
            json_match = re.search(r"\{[\s\S]*\}", clean_json_str)
            if json_match:
                clean_json_str = json_match.group(0)
            parsed = json.loads(clean_json_str)

            # Validate key fields
            if "overall_score" in parsed and "breakdown" in parsed:
                # Ensure minimum 3 recommendations
                recs = parsed.get("recommendations") or []
                if len(recs) < 3:
                    recs.extend(deterministic_result.get("recommendations", []))
                    parsed["recommendations"] = recs[:6]
                return parsed

    except Exception as e:
        logger.warning(f"Hugging Face ATS scoring failed, falling back to deterministic engine: {e}")

    return deterministic_result
