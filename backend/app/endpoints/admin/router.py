"""
Admin API endpoints — dashboard, user management, feature management.
All endpoints require admin authentication.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.admin import (
    bulk_assign_feature,
    create_feature,
    delete_feature,
    get_all_features,
    get_all_users,
    get_current_user_features,
    get_dashboard_stats,
    get_user_detail,
    get_user_features,
    toggle_user_feature,
    update_feature,
    update_user_role,
    update_user_status,
)
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_admin, get_current_user
from app.schemas.admin import (
    AdminDashboardStats,
    BulkFeatureAssignRequest,
    FeatureCreateRequest,
    FeatureResponse,
    FeatureUpdateRequest,
    UserAdminListResponse,
    UserAdminResponse,
    UserFeatureInfo,
    UserFeatureToggleRequest,
    UserRoleUpdateRequest,
    UserStatusUpdateRequest,
)

router = APIRouter(tags=["admin"])


# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=AdminDashboardStats)
async def dashboard(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> AdminDashboardStats:
    """Get admin dashboard analytics."""
    return await get_dashboard_stats(db)


# ─── User Management ────────────────────────────────────────────────────────

@router.get("/users", response_model=UserAdminListResponse)
async def list_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> UserAdminListResponse:
    """List all users with search and pagination."""
    return await get_all_users(db, search=search, page=page, limit=limit)


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def user_detail(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> UserAdminResponse:
    """Get detailed info for a specific user."""
    return await get_user_detail(db, user_id)


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
async def change_user_role(
    user_id: str,
    data: UserRoleUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> UserAdminResponse:
    """Update a user's role (user/admin)."""
    return await update_user_role(db, user_id, data.role)


@router.patch("/users/{user_id}/status", response_model=UserAdminResponse)
async def change_user_status(
    user_id: str,
    data: UserStatusUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> UserAdminResponse:
    """Suspend or activate a user account."""
    return await update_user_status(db, user_id, data.is_active)


# ─── User Feature Assignments ───────────────────────────────────────────────

@router.get("/users/{user_id}/features", response_model=list[UserFeatureInfo])
async def list_user_features(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> list[UserFeatureInfo]:
    """Get all feature assignments for a user."""
    return await get_user_features(db, user_id)


@router.put("/users/{user_id}/features", response_model=UserFeatureInfo)
async def toggle_feature_for_user(
    user_id: str,
    data: UserFeatureToggleRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> UserFeatureInfo:
    """Enable or disable a feature for a user."""
    return await toggle_user_feature(db, user_id, data.feature_id, data.is_enabled, admin.id)


# ─── Feature Management ─────────────────────────────────────────────────────

@router.get("/features", response_model=list[FeatureResponse])
async def list_features(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> list[FeatureResponse]:
    """List all feature definitions."""
    return await get_all_features(db)


@router.post("/features", response_model=FeatureResponse, status_code=201)
async def create_new_feature(
    data: FeatureCreateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> FeatureResponse:
    """Create a new feature definition."""
    return await create_feature(db, data)


@router.put("/features/{feature_id}", response_model=FeatureResponse)
async def update_existing_feature(
    feature_id: str,
    data: FeatureUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> FeatureResponse:
    """Update a feature's name, description, or active status."""
    return await update_feature(db, feature_id, data)


@router.delete("/features/{feature_id}")
async def remove_feature(
    feature_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Delete a feature and all its user assignments."""
    return await delete_feature(db, feature_id)


@router.post("/features/{feature_id}/bulk-assign")
async def bulk_assign_feature_to_users(
    feature_id: str,
    data: BulkFeatureAssignRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Bulk enable/disable a feature for multiple users."""
    return await bulk_assign_feature(db, feature_id, data.user_ids, data.is_enabled, admin.id)


# ─── Current User Features (for non-admin users too) ────────────────────────

@router.get("/my-features", response_model=list[str])
async def my_features(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[str]:
    """Get the list of enabled feature keys for the current logged-in user."""
    return await get_current_user_features(db, current_user.id)
