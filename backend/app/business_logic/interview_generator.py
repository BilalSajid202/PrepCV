import json
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database.models import InterviewSession, Resume, User
from app.integrations.tavily.client import extract_company_intelligence
from app.business_logic.feedback_rag import retrieve_relevant_interview_feedback
from app.integrations.gemini.client import _call_gemini_json_api, PRIMARY_MODEL, FALLBACK_MODEL
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def _sanitize_string(val: Any, max_len: int = 4000) -> str:
    if not isinstance(val, str):
        return ""
    clean = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", val).strip()
    return clean[:max_len]


def _generate_fallback_questions(
    job_title: str,
    company_name: str,
    skills: List[str],
    retrieved_feedback: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Deterministic high-quality interview question set fallback (compliant with NFR-2)."""
    top_skills = skills[:4] if skills else ["Python", "System Design", "Databases"]
    s1 = top_skills[0] if len(top_skills) > 0 else "Python"
    s2 = top_skills[1] if len(top_skills) > 1 else "FastAPI"
    s3 = top_skills[2] if len(top_skills) > 2 else "Docker"

    questions: List[Dict[str, Any]] = [
        # Behavioral (3-4)
        {
            "id": "q-1",
            "category": "Behavioral",
            "question": f"Why are you specifically interested in joining {company_name} in this {job_title} capacity?",
            "difficulty": "Medium",
            "focus_area": "Company Fit & Motivation",
            "source": "curated_template"
        },
        {
            "id": "q-2",
            "category": "Behavioral",
            "question": "Tell me about a complex project where you faced tight deadlines or unexpected technical hurdles. How did you navigate trade-offs?",
            "difficulty": "Medium",
            "focus_area": "Problem Solving & Execution",
            "source": "curated_template"
        },
        {
            "id": "q-3",
            "category": "Behavioral",
            "question": "Describe a situation where you had a technical disagreement with a teammate or stakeholder. How did you reach alignment?",
            "difficulty": "Hard",
            "focus_area": "Collaboration & Communication",
            "source": "curated_template"
        },
        # Technical (3-4)
        {
            "id": "q-4",
            "category": "Technical",
            "question": f"How do you design scalable backend services using {s1} and {s2} while maintaining low latency under heavy concurrent loads?",
            "difficulty": "Hard",
            "focus_area": f"{s1} & {s2} Architecture",
            "source": "curated_template"
        },
        {
            "id": "q-5",
            "category": "Technical",
            "question": f"How do you handle containerization, environment parity, and CI/CD automated deployments with {s3} in production?",
            "difficulty": "Medium",
            "focus_area": "DevOps & Deployment",
            "source": "curated_template"
        },
        {
            "id": "q-6",
            "category": "Technical",
            "question": "How do you ensure data integrity and optimize query execution when dealing with large relational or document datasets?",
            "difficulty": "Medium",
            "focus_area": "Database Optimization",
            "source": "curated_template"
        },
        # Role-Specific & Situational (3-4)
        {
            "id": "q-7",
            "category": "Role-Specific",
            "question": f"If an endpoint at {company_name} suddenly experiences high error rates or latency spikes in production, what is your step-by-step diagnostic workflow?",
            "difficulty": "Hard",
            "focus_area": "Incident Response & Reliability",
            "source": "curated_template"
        },
        {
            "id": "q-8",
            "category": "Role-Specific",
            "question": f"Given {company_name}'s domain, how would you approach architecting a new core feature from requirements gathering to monitoring in production?",
            "difficulty": "Hard",
            "focus_area": "End-to-End System Design",
            "source": "curated_template"
        },
        {
            "id": "q-9",
            "category": "Role-Specific",
            "question": "How do you balance shipping features rapidly versus paying down technical debt and writing comprehensive test suites?",
            "difficulty": "Medium",
            "focus_area": "Engineering Pragmatism",
            "source": "curated_template"
        },
    ]

    # If we have RAG feedback questions, inject up to 2 real questions into the mix
    if retrieved_feedback:
        for idx, item in enumerate(retrieved_feedback[:2]):
            questions.insert(3 + idx, {
                "id": f"q-rag-{idx+1}",
                "category": "Technical" if "how" in item["question"].lower() else "Role-Specific",
                "question": item["question"],
                "difficulty": "Hard",
                "focus_area": f"Past {company_name} Interview Question",
                "source": "rag_community_feedback"
            })

    return questions[:11]


async def generate_interview_questions(
    db: AsyncSession,
    user: User,
    company_name: str,
    job_title: str,
    company_url: str = "",
    jd_text: str = "",
    resume_id: Optional[str] = None,
) -> InterviewSession:
    """
    Generate tailored 9–12 interview questions using Company Intelligence (Tavily/Scraping),
    Candidate Resume, Target Job Description, and community feedback RAG loop (FR-13, FR-14, FR-21, FR-22).
    """
    clean_company = _sanitize_string(company_name, 150) or "Target Company"
    clean_title = _sanitize_string(job_title, 150) or "Software Engineer"
    clean_url = _sanitize_string(company_url, 300)
    clean_jd = _sanitize_string(jd_text, 4000)

    # 1. Fetch Candidate Resume content if resume_id provided
    resume_content_dict: Dict[str, Any] = {}
    resume_skills: List[str] = []
    if resume_id:
        r_stmt = select(Resume).where(Resume.id == resume_id, Resume.user_id == user.id)
        r_res = await db.execute(r_stmt)
        resume_obj = r_res.scalar_one_or_none()
        if resume_obj and resume_obj.content:
            resume_content_dict = resume_obj.content
            resume_skills = resume_content_dict.get("skills", [])

    # 2. Extract Company Intelligence using Tavily (or graceful scraper fallback)
    company_insights = await extract_company_intelligence(clean_company, clean_url)

    # 3. Retrieve past real-interview feedback questions (RAG Loop)
    rag_feedback_examples = await retrieve_relevant_interview_feedback(
        db=db,
        company_name=clean_company,
        job_title=clean_title,
        limit=5,
    )

    # 4. Generate questions using Gemini with rich multi-source context
    settings = get_settings()
    api_key = settings.gemini_api_key

    generated_questions: List[Dict[str, Any]] = []

    if api_key:
        try:
            system_instruction = """You are a senior hiring manager and tech interview architect.
Generate a tailored, high-caliber set of 9 to 11 interview questions customized for the candidate, company, and role.
Structure the questions cleanly across 3 distinct categories:
1. Behavioral (3-4 questions: leadership, conflict resolution, company culture fit)
2. Technical (3-4 questions: architecture, specific tools, code design, debugging)
3. Role-Specific & Situational (3-4 questions: domain scenarios, trade-offs, production incidents)

Return ONLY a JSON object with this exact schema:
{
  "questions": [
    {
      "id": "q-1",
      "category": "Behavioral",
      "question": "Tell me about...",
      "difficulty": "Medium",
      "focus_area": "Teamwork & Conflict"
    }
  ]
}

CRITICAL RULES:
- Questions ONLY (do NOT output sample answers).
- Directly incorporate the company's domain, target tech stack, and candidate's experience.
- If real interview feedback examples are provided in context, adapt them into realistic interview challenges.
"""

            user_payload = json.dumps({
                "company_name": clean_company,
                "company_url": clean_url,
                "company_intelligence": company_insights.get("summary", ""),
                "job_title": clean_title,
                "job_description": clean_jd[:3000],
                "candidate_skills": resume_skills[:20],
                "candidate_summary": resume_content_dict.get("summary", "")[:500],
                "past_real_interview_feedback_examples": [f["question"] for f in rag_feedback_examples]
            })

            raw_response = await _call_gemini_json_api(
                system_instruction=system_instruction,
                user_payload=user_payload,
                api_key=api_key,
                model_name=PRIMARY_MODEL,
                retry_count=1,
            )

            if raw_response:
                clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_response.strip(), flags=re.MULTILINE)
                parsed = json.loads(clean_json)
                q_list = parsed.get("questions", [])
                if isinstance(q_list, list) and len(q_list) >= 6:
                    for i, q in enumerate(q_list):
                        q["id"] = f"q-{i+1}"
                        if not q.get("difficulty"): q["difficulty"] = "Medium"
                        if not q.get("focus_area"): q["focus_area"] = q.get("category", "General")
                    generated_questions = q_list
                    logger.info(f"Successfully generated {len(generated_questions)} AI interview questions for {clean_company}.")
        except Exception as e:
            logger.warning(f"Gemini interview question generation failed: {e}. Using deterministic fallback.")

    # Fallback if AI generation failed or key missing
    if not generated_questions:
        generated_questions = _generate_fallback_questions(
            job_title=clean_title,
            company_name=clean_company,
            skills=resume_skills,
            retrieved_feedback=rag_feedback_examples,
        )

    # 5. Save session record in DB
    session = InterviewSession(
        user_id=user.id,
        resume_id=resume_id,
        company_name=clean_company,
        company_url=clean_url,
        job_title=clean_title,
        jd_text=clean_jd,
        company_insights=company_insights,
        generated_questions=generated_questions,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info(f"Created InterviewSession {session.id} for user {user.id}")
    return session
