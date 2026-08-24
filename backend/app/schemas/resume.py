from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field
from app.schemas.profile import ProfileSchema


class ResumeContentSchema(BaseModel):
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
    profile_snapshot: Dict[str, Any]
    content: ResumeContentSchema
    created_at: str
    updated_at: str


class AIImproveRequest(BaseModel):
    section: str = Field(..., max_length=50) # e.g. 'summary', 'bullet', 'experience'
    text: str = Field(..., max_length=2000)
    instruction: Optional[str] = Field(default="Improve bullet point for ATS impact", max_length=255)


class AIImproveResponse(BaseModel):
    original_text: str
    improved_text: str
    explanation: Optional[str] = None
