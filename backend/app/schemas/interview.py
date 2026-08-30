from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class InterviewQuestionSchema(BaseModel):
    id: str
    category: str = Field(..., description="'Behavioral' | 'Technical' | 'Role-Specific'")
    question: str
    difficulty: Optional[str] = "Medium"
    focus_area: Optional[str] = "General"
    source: Optional[str] = None


class InterviewGenerateRequest(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=150)
    job_title: str = Field(..., min_length=2, max_length=150)
    company_url: Optional[str] = Field(default="", max_length=500)
    jd_text: Optional[str] = Field(default="", max_length=15000)
    resume_id: Optional[str] = None


class InterviewSessionResponse(BaseModel):
    id: str
    user_id: str
    resume_id: Optional[str] = None
    company_name: str
    company_url: str
    job_title: str
    jd_text: str
    company_insights: Dict[str, Any] = Field(default_factory=dict)
    generated_questions: List[InterviewQuestionSchema] = Field(default_factory=list)
    created_at: str
    updated_at: str


class InterviewFeedbackSubmitRequest(BaseModel):
    session_id: Optional[str] = None
    actual_questions_text: str = Field(..., min_length=10, max_length=10000)
    company_name: Optional[str] = Field(default=None, max_length=150)
    job_title: Optional[str] = Field(default=None, max_length=150)
    industry: Optional[str] = Field(default=None, max_length=100)


class InterviewFeedbackResponse(BaseModel):
    id: str
    session_id: Optional[str] = None
    user_id: str
    actual_questions_text: str
    anonymized_questions_text: str
    extracted_questions: List[str] = Field(default_factory=list)
    company_tag: str
    role_tag: str
    industry_tag: str
    created_at: str
