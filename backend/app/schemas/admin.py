from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


# ─── Feature Schemas ─────────────────────────────────────────────────────────

class FeatureCreateRequest(BaseModel):
    key: str
    name: str
    description: str = ""

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        cleaned = v.strip().lower().replace(" ", "_")
        if len(cleaned) < 2:
            raise ValueError("Feature key must be at least 2 characters")
        return cleaned

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Feature name must be at least 2 characters")
        return cleaned


class FeatureUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class FeatureResponse(BaseModel):
    id: str
    key: str
    name: str
    description: str
    is_active: bool
    created_at: datetime
    assigned_users_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ─── User Admin Schemas ──────────────────────────────────────────────────────

class UserFeatureInfo(BaseModel):
    feature_id: str
    feature_key: str
    feature_name: str
    is_enabled: bool
    granted_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserActivityStats(BaseModel):
    resumes_count: int = 0
    interview_sessions_count: int = 0
    interview_feedbacks_count: int = 0


class UserAdminResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    features: list[UserFeatureInfo] = []
    activity: UserActivityStats = UserActivityStats()

    model_config = ConfigDict(from_attributes=True)


class UserAdminListResponse(BaseModel):
    users: list[UserAdminResponse]
    total: int
    page: int
    limit: int


class UserRoleUpdateRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "admin"):
            raise ValueError("Role must be 'user' or 'admin'")
        return v


class UserStatusUpdateRequest(BaseModel):
    is_active: bool


class UserFeatureToggleRequest(BaseModel):
    feature_id: str
    is_enabled: bool


class BulkFeatureAssignRequest(BaseModel):
    user_ids: list[str]
    is_enabled: bool


# ─── Dashboard Schemas ───────────────────────────────────────────────────────

class FeatureUsageStat(BaseModel):
    feature_id: str
    feature_key: str
    feature_name: str
    enabled_users_count: int


class RecentUser(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime


class AIUsageLogEntry(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    feature: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    response_time_ms: int
    status: str
    api_key_hint: str
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIFeatureUsageBreakdown(BaseModel):
    feature: str
    feature_name: str
    total_calls: int
    total_tokens: int
    input_tokens: int
    output_tokens: int
    avg_response_time_ms: int


class AIUserUsageStat(BaseModel):
    user_id: str
    full_name: str
    email: str
    total_calls: int
    total_tokens: int
    last_used_at: Optional[datetime] = None


class AIModelUsageStat(BaseModel):
    model: str
    total_calls: int
    total_tokens: int


class AIUsageStats(BaseModel):
    total_calls: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_tokens: int = 0
    avg_response_time_ms: int = 0
    active_keys_count: int = 0
    total_keys_count: int = 0
    feature_breakdown: list[AIFeatureUsageBreakdown] = []
    top_users: list[AIUserUsageStat] = []
    model_breakdown: list[AIModelUsageStat] = []
    recent_logs: list[AIUsageLogEntry] = []


class AdminDashboardStats(BaseModel):
    total_users: int
    active_users: int
    suspended_users: int
    admin_users: int
    total_resumes: int
    total_interview_sessions: int
    total_interview_feedbacks: int
    total_features: int
    feature_usage: list[FeatureUsageStat] = []
    recent_users: list[RecentUser] = []
    ai_usage: Optional[AIUsageStats] = None

