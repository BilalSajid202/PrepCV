from typing import List, Optional
from pydantic import BaseModel, Field


class PersonalInfoSchema(BaseModel):
    full_name: str = Field(default="", max_length=150)
    professional_title: str = Field(default="", max_length=150)
    email: str = Field(default="", max_length=150)
    phone: str = Field(default="", max_length=50)
    location: str = Field(default="", max_length=150)
    linkedin_url: Optional[str] = Field(default="", max_length=255)
    github_url: Optional[str] = Field(default="", max_length=255)
    portfolio_url: Optional[str] = Field(default="", max_length=255)
    summary: Optional[str] = Field(default="", max_length=2000)


class ExperienceItemSchema(BaseModel):
    id: Optional[str] = None
    company: str = Field(default="", max_length=150)
    position: str = Field(default="", max_length=150)
    location: Optional[str] = Field(default="", max_length=150)
    employment_type: Optional[str] = Field(default="", max_length=50)
    start_date: str = Field(default="", max_length=50)
    end_date: Optional[str] = Field(default="", max_length=50)
    is_current: bool = False
    description: Optional[str] = Field(default="", max_length=2000)
    achievements: List[str] = Field(default_factory=list)


class EducationItemSchema(BaseModel):
    id: Optional[str] = None
    institution: str = Field(default="", max_length=150)
    degree: str = Field(default="", max_length=150)
    field_of_study: Optional[str] = Field(default="", max_length=150)
    start_date: str = Field(default="", max_length=50)
    end_date: Optional[str] = Field(default="", max_length=50)
    is_current: bool = False
    gpa: Optional[str] = Field(default="", max_length=20)
    description: Optional[str] = Field(default="", max_length=1000)


class ProjectItemSchema(BaseModel):
    id: Optional[str] = None
    name: str = Field(default="", max_length=150)
    description: str = Field(default="", max_length=2000)
    technologies: List[str] = Field(default_factory=list)
    project_url: Optional[str] = Field(default="", max_length=255)
    github_url: Optional[str] = Field(default="", max_length=255)
    achievements: List[str] = Field(default_factory=list)


class CertificationItemSchema(BaseModel):
    id: Optional[str] = None
    name: str = Field(default="", max_length=150)
    issuing_organization: str = Field(default="", max_length=150)
    issue_date: str = Field(default="", max_length=50)
    expiration_date: Optional[str] = Field(default="", max_length=50)
    credential_id: Optional[str] = Field(default="", max_length=100)
    credential_url: Optional[str] = Field(default="", max_length=255)


class ProfileSchema(BaseModel):
    personal_info: PersonalInfoSchema = Field(default_factory=PersonalInfoSchema)
    experience: List[ExperienceItemSchema] = Field(default_factory=list)
    education: List[EducationItemSchema] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    projects: List[ProjectItemSchema] = Field(default_factory=list)
    certifications: List[CertificationItemSchema] = Field(default_factory=list)


class ProfileResponse(BaseModel):
    id: str
    user_id: str
    personal_info: PersonalInfoSchema
    experience: List[ExperienceItemSchema]
    education: List[EducationItemSchema]
    skills: List[str]
    projects: List[ProjectItemSchema]
    certifications: List[CertificationItemSchema]
    created_at: str
    updated_at: str
