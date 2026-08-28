from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from app.schemas.profile import ProfileSchema


class ResumeContentSchema(BaseModel):
    personal_info: Optional[Dict[str, Any]] = Field(default_factory=dict)
    summary: str = Field(default="")
    experience: List[Dict[str, Any]] = Field(default_factory=list)
    education: List[Dict[str, Any]] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    certifications: List[Dict[str, Any]] = Field(default_factory=list)


class ResumeGenerateRequest(BaseModel):
    title: Optional[str] = Field(default="ATS Optimized Resume", max_length=255)
    target_role: Optional[str] = Field(default="", max_length=150)
    custom_instructions: Optional[str] = Field(default="", max_length=1000)
    profile: Optional[ProfileSchema] = None


class ResumeUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: Optional[ResumeContentSchema] = None


class ResumeResponse(BaseModel):
    id: str
    user_id: str
    title: str
    version: int = 1
    ats_score: Optional[int] = None
    target_jd: Optional[str] = None
    profile_snapshot: Dict[str, Any]
    content: ResumeContentSchema
    created_at: str
    updated_at: str


class AIImproveRequest(BaseModel):
    section: str = Field(..., max_length=50)  # e.g. 'summary', 'bullet', 'experience'
    text: str = Field(..., max_length=2000)
    instruction: Optional[str] = Field(default="Improve bullet point for ATS impact", max_length=255)


class AIImproveResponse(BaseModel):
    original_text: str
    improved_text: str
    explanation: Optional[str] = None


# ===========================================================================
# ATS Match Scoring Schemas (FR-8, FR-9)
# ===========================================================================

class ATSScoreRequest(BaseModel):
    job_description: str = Field(..., min_length=10, max_length=15000)
    content: Optional[ResumeContentSchema] = None


class MissingKeyword(BaseModel):
    skill: str
    count_in_jd: int = 1
    section: str = "skills"


class ATSRecommendation(BaseModel):
    id: str
    title: str
    description: str
    action_type: str = Field(default="add_skill", description="'add_skill' | 'edit_experience' | 'edit_summary'")
    target_text: Optional[str] = None
    category: Optional[str] = "Skills"


class ScoreBreakdown(BaseModel):
    keyword_match: int
    skills_match: int
    experience_match: int
    education_match: int


class KeywordStats(BaseModel):
    matched_keywords_count: int
    total_jd_keywords_count: int


class ATSScoreResponse(BaseModel):
    overall_score: int
    previous_score: Optional[int] = None
    score_change: Optional[int] = None
    score_tier: str
    score_summary: str
    keyword_stats: KeywordStats
    breakdown: ScoreBreakdown
    missing_keywords: List[MissingKeyword] = Field(default_factory=list)
    matching_skills: List[str] = Field(default_factory=list)
    recommendations: List[ATSRecommendation] = Field(default_factory=list)


# ===========================================================================
# Resume Versioning Schemas (FR-10, FR-12)
# ===========================================================================

class CreateVersionRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    content: ResumeContentSchema
    change_summary: Optional[str] = Field(default="Manual save", max_length=255)
    ats_score: Optional[int] = None


class ResumeVersionResponse(BaseModel):
    id: str
    resume_id: str
    version_number: int
    title: str
    change_summary: str
    ats_score: Optional[int] = None
    created_at: str


class ResumeVersionDetailResponse(BaseModel):
    id: str
    resume_id: str
    version_number: int
    title: str
    change_summary: str
    content: ResumeContentSchema
    ats_score: Optional[int] = None
    target_jd: Optional[str] = None
    created_at: str


class VersionCompareResponse(BaseModel):
    resume_id: str
    base_version: Dict[str, Any]
    compared_version: Dict[str, Any]
    diff: Dict[str, Any]
