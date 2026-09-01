"""
Admin business logic — user management, feature management, dashboard analytics.
"""

import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.models import (
    AIUsageLog,
    Feature,
    InterviewFeedback,
    InterviewSession,
    Resume,
    User,
    UserFeature,
)
from app.schemas.admin import (
    AdminDashboardStats,
    AIFeatureUsageBreakdown,
    AIModelUsageStat,
    AIUsageLogEntry,
    AIUsageStats,
    AIUserUsageStat,
    FeatureCreateRequest,
    FeatureResponse,
    FeatureUpdateRequest,
    FeatureUsageStat,
    RecentUser,
    UserActivityStats,
    UserAdminListResponse,
    UserAdminResponse,
    UserFeatureInfo,
)

logger = logging.getLogger("prepcv")


# ─── User Management ────────────────────────────────────────────────────────

async def get_all_users(
    db: AsyncSession,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> UserAdminListResponse:
    """Get paginated list of all users with search support."""
    base_query = select(User)
    count_query = select(func.count(User.id))

    if search:
        search_filter = User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        base_query = base_query.where(search_filter)
        count_query = count_query.where(search_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * limit
    users_result = await db.execute(
        base_query.order_by(User.created_at.desc()).offset(offset).limit(limit)
    )
    users = users_result.scalars().all()

    user_responses = []
    for u in users:
        activity = await _get_user_activity(db, u.id)
        features = await _get_user_feature_infos(db, u.id)
        user_responses.append(
            UserAdminResponse(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                created_at=u.created_at,
                updated_at=u.updated_at,
                features=features,
                activity=activity,
            )
        )

    return UserAdminListResponse(users=user_responses, total=total, page=page, limit=limit)


async def get_user_detail(db: AsyncSession, user_id: str) -> UserAdminResponse:
    """Get detailed user info with features and activity stats."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    activity = await _get_user_activity(db, user_id)
    features = await _get_user_feature_infos(db, user_id)

    return UserAdminResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        updated_at=user.updated_at,
        features=features,
        activity=activity,
    )


async def update_user_role(db: AsyncSession, user_id: str, role: str) -> UserAdminResponse:
    """Update a user's role (user/admin)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = role
    await db.commit()
    await db.refresh(user)
    logger.info(f"User {user.email} role updated to '{role}'")
    return await get_user_detail(db, user_id)


async def update_user_status(db: AsyncSession, user_id: str, is_active: bool) -> UserAdminResponse:
    """Suspend or activate a user account."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = is_active
    await db.commit()
    await db.refresh(user)
    action = "activated" if is_active else "suspended"
    logger.info(f"User {user.email} {action}")
    return await get_user_detail(db, user_id)


# ─── Feature Management ─────────────────────────────────────────────────────

async def get_all_features(db: AsyncSession) -> list[FeatureResponse]:
    """Get all defined features with assigned user counts."""
    result = await db.execute(select(Feature).order_by(Feature.created_at.asc()))
    features = result.scalars().all()

    responses = []
    for f in features:
        count_result = await db.execute(
            select(func.count(UserFeature.id)).where(
                and_(UserFeature.feature_id == f.id, UserFeature.is_enabled == True)
            )
        )
        count = count_result.scalar() or 0
        responses.append(
            FeatureResponse(
                id=f.id,
                key=f.key,
                name=f.name,
                description=f.description,
                is_active=f.is_active,
                created_at=f.created_at,
                assigned_users_count=count,
            )
        )
    return responses


async def create_feature(db: AsyncSession, data: FeatureCreateRequest) -> FeatureResponse:
    """Create a new feature definition."""
    existing = await db.execute(select(Feature).where(Feature.key == data.key))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail=f"Feature with key '{data.key}' already exists")

    feature = Feature(key=data.key, name=data.name, description=data.description)
    db.add(feature)
    await db.commit()
    await db.refresh(feature)
    logger.info(f"Created feature: {feature.name} ({feature.key})")
    return FeatureResponse(
        id=feature.id,
        key=feature.key,
        name=feature.name,
        description=feature.description,
        is_active=feature.is_active,
        created_at=feature.created_at,
        assigned_users_count=0,
    )


async def update_feature(db: AsyncSession, feature_id: str, data: FeatureUpdateRequest) -> FeatureResponse:
    """Update an existing feature's details or active status."""
    result = await db.execute(select(Feature).where(Feature.id == feature_id))
    feature = result.scalars().first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    if data.name is not None:
        feature.name = data.name
    if data.description is not None:
        feature.description = data.description
    if data.is_active is not None:
        feature.is_active = data.is_active

    await db.commit()
    await db.refresh(feature)

    count_result = await db.execute(
        select(func.count(UserFeature.id)).where(
            and_(UserFeature.feature_id == feature.id, UserFeature.is_enabled == True)
        )
    )
    count = count_result.scalar() or 0

    return FeatureResponse(
        id=feature.id,
        key=feature.key,
        name=feature.name,
        description=feature.description,
        is_active=feature.is_active,
        created_at=feature.created_at,
        assigned_users_count=count,
    )


async def delete_feature(db: AsyncSession, feature_id: str) -> dict:
    """Delete a feature and all its user assignments."""
    result = await db.execute(select(Feature).where(Feature.id == feature_id))
    feature = result.scalars().first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    await db.delete(feature)
    await db.commit()
    logger.info(f"Deleted feature: {feature.name} ({feature.key})")
    return {"message": f"Feature '{feature.name}' deleted successfully"}


# ─── User Feature Assignments ───────────────────────────────────────────────

async def get_user_features(db: AsyncSession, user_id: str) -> list[UserFeatureInfo]:
    """Get all feature assignments for a user."""
    return await _get_user_feature_infos(db, user_id)


async def toggle_user_feature(
    db: AsyncSession,
    user_id: str,
    feature_id: str,
    is_enabled: bool,
    admin_id: str,
) -> UserFeatureInfo:
    """Enable or disable a specific feature for a user."""
    # Validate user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    if not user_result.scalars().first():
        raise HTTPException(status_code=404, detail="User not found")

    # Validate feature exists
    feature_result = await db.execute(select(Feature).where(Feature.id == feature_id))
    feature = feature_result.scalars().first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    # Upsert user feature assignment
    existing_result = await db.execute(
        select(UserFeature).where(
            and_(UserFeature.user_id == user_id, UserFeature.feature_id == feature_id)
        )
    )
    uf = existing_result.scalars().first()

    if uf:
        uf.is_enabled = is_enabled
        uf.granted_by = admin_id
    else:
        uf = UserFeature(
            user_id=user_id,
            feature_id=feature_id,
            is_enabled=is_enabled,
            granted_by=admin_id,
        )
        db.add(uf)

    await db.commit()
    await db.refresh(uf)

    return UserFeatureInfo(
        feature_id=feature.id,
        feature_key=feature.key,
        feature_name=feature.name,
        is_enabled=uf.is_enabled,
        granted_at=uf.granted_at,
    )


async def bulk_assign_feature(
    db: AsyncSession,
    feature_id: str,
    user_ids: list[str],
    is_enabled: bool,
    admin_id: str,
) -> dict:
    """Bulk enable/disable a feature for multiple users."""
    feature_result = await db.execute(select(Feature).where(Feature.id == feature_id))
    feature = feature_result.scalars().first()
    if not feature:
        raise HTTPException(status_code=404, detail="Feature not found")

    updated = 0
    for uid in user_ids:
        existing_result = await db.execute(
            select(UserFeature).where(
                and_(UserFeature.user_id == uid, UserFeature.feature_id == feature_id)
            )
        )
        uf = existing_result.scalars().first()
        if uf:
            uf.is_enabled = is_enabled
            uf.granted_by = admin_id
        else:
            uf = UserFeature(
                user_id=uid,
                feature_id=feature_id,
                is_enabled=is_enabled,
                granted_by=admin_id,
            )
            db.add(uf)
        updated += 1

    await db.commit()
    action = "enabled" if is_enabled else "disabled"
    return {"message": f"Feature '{feature.name}' {action} for {updated} users"}


# Core features that all users have access to by default without needing admin assignment
DEFAULT_FREE_FEATURES = {"resume_generation", "cv_upload"}


# ─── Feature Access Check (used by feature guards) ──────────────────────────

async def check_user_feature_access(db: AsyncSession, user_id: str, feature_key: str) -> bool:
    """Check if a user has access to a specific feature.
    
    Access Rules:
    1. Admin users always have access to all features.
    2. The feature must exist and be globally active (kill-switch).
    3. Core features (resume_generation, cv_upload) are accessible by default to all users,
       unless explicitly denied (is_enabled = False in user_features).
    4. Advanced features (ats_checker, interview_prep, etc.) require explicit admin grant
       (is_enabled = True in user_features).
    """
    # 1. Admin bypass
    user_result = await db.execute(select(User.role).where(User.id == user_id))
    user_role = user_result.scalar()
    if user_role == "admin":
        return True

    # 2. Check feature exists and is globally active
    feature_result = await db.execute(
        select(Feature).where(and_(Feature.key == feature_key, Feature.is_active == True))
    )
    feature = feature_result.scalars().first()
    if not feature:
        return False

    # Check if there is an explicit user_features assignment
    uf_result = await db.execute(
        select(UserFeature).where(
            and_(
                UserFeature.user_id == user_id,
                UserFeature.feature_id == feature.id,
            )
        )
    )
    uf = uf_result.scalars().first()

    if uf is not None:
        return uf.is_enabled

    # 3. Default access for core features (manual details & cv upload)
    if feature_key in DEFAULT_FREE_FEATURES:
        return True

    # 4. Gated features (ats_checker, interview_prep) require explicit grant
    return False


# ─── Dashboard Analytics ─────────────────────────────────────────────────────

async def get_dashboard_stats(db: AsyncSession) -> AdminDashboardStats:
    """Aggregate analytics for the admin dashboard."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
    suspended_users = (await db.execute(select(func.count(User.id)).where(User.is_active == False))).scalar() or 0
    admin_users = (await db.execute(select(func.count(User.id)).where(User.role == "admin"))).scalar() or 0
    total_resumes = (await db.execute(select(func.count(Resume.id)))).scalar() or 0
    total_sessions = (await db.execute(select(func.count(InterviewSession.id)))).scalar() or 0
    total_feedbacks = (await db.execute(select(func.count(InterviewFeedback.id)))).scalar() or 0
    total_features = (await db.execute(select(func.count(Feature.id)))).scalar() or 0

    # Feature usage breakdown
    features_result = await db.execute(select(Feature).order_by(Feature.created_at.asc()))
    features = features_result.scalars().all()
    feature_usage = []
    for f in features:
        if f.key in DEFAULT_FREE_FEATURES:
            # Default enabled: total active users minus explicitly disabled
            disabled_count = (
                await db.execute(
                    select(func.count(UserFeature.id)).where(
                        and_(UserFeature.feature_id == f.id, UserFeature.is_enabled == False)
                    )
                )
            ).scalar() or 0
            count = max(0, active_users - disabled_count)
        else:
            # Gated: only explicitly enabled users + admins
            explicit_count = (
                await db.execute(
                    select(func.count(UserFeature.id)).where(
                        and_(UserFeature.feature_id == f.id, UserFeature.is_enabled == True)
                    )
                )
            ).scalar() or 0
            count = explicit_count + admin_users

        feature_usage.append(
            FeatureUsageStat(
                feature_id=f.id,
                feature_key=f.key,
                feature_name=f.name,
                enabled_users_count=min(count, total_users),
            )
        )

    # Recent users (last 10 signups)
    recent_result = await db.execute(
        select(User).order_by(User.created_at.desc()).limit(10)
    )
    recent_users = [
        RecentUser(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in recent_result.scalars().all()
    ]

    # AI Usage Analytics
    ai_usage = await get_ai_usage_analytics(db)

    return AdminDashboardStats(
        total_users=total_users,
        active_users=active_users,
        suspended_users=suspended_users,
        admin_users=admin_users,
        total_resumes=total_resumes,
        total_interview_sessions=total_sessions,
        total_interview_feedbacks=total_feedbacks,
        total_features=total_features,
        feature_usage=feature_usage,
        recent_users=recent_users,
        ai_usage=ai_usage,
    )


# ─── AI Usage Analytics ──────────────────────────────────────────────────────

FEATURE_LABEL_MAP = {
    "cv_extraction": "CV Upload & Extraction",
    "cv_formatting": "AI Profile Formatter",
    "ats_scoring": "ATS Compatibility Scorer",
    "interview_prep": "AI Interview Question Generator",
    "ai_improve": "AI Bullet Optimizer",
}


async def get_ai_usage_analytics(db: AsyncSession) -> AIUsageStats:
    """Compute comprehensive AI usage analytics including total tokens, per-feature, per-user, and recent logs."""
    from app.integrations.huggingface.client import get_hf_key_manager

    km = get_hf_key_manager()
    active_keys = km.active_key_count
    total_keys = km.key_count

    # 1. Total Aggregates
    totals_query = select(
        func.count(AIUsageLog.id).label("total_calls"),
        func.coalesce(func.sum(AIUsageLog.input_tokens), 0).label("total_input"),
        func.coalesce(func.sum(AIUsageLog.output_tokens), 0).label("total_output"),
        func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.avg(AIUsageLog.response_time_ms), 0).label("avg_latency"),
    )
    totals_res = (await db.execute(totals_query)).first()

    total_calls = totals_res.total_calls if totals_res else 0
    total_input = int(totals_res.total_input) if totals_res else 0
    total_output = int(totals_res.total_output) if totals_res else 0
    total_tokens = int(totals_res.total_tokens) if totals_res else 0
    avg_latency = int(totals_res.avg_latency) if totals_res else 0

    # 2. Feature Breakdown
    feat_query = (
        select(
            AIUsageLog.feature,
            func.count(AIUsageLog.id).label("call_count"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("tokens"),
            func.coalesce(func.sum(AIUsageLog.input_tokens), 0).label("in_tokens"),
            func.coalesce(func.sum(AIUsageLog.output_tokens), 0).label("out_tokens"),
            func.coalesce(func.avg(AIUsageLog.response_time_ms), 0).label("avg_time"),
        )
        .group_by(AIUsageLog.feature)
        .order_by(func.sum(AIUsageLog.total_tokens).desc())
    )
    feat_res = (await db.execute(feat_query)).all()
    feature_breakdown = [
        AIFeatureUsageBreakdown(
            feature=r.feature,
            feature_name=FEATURE_LABEL_MAP.get(r.feature, r.feature.replace("_", " ").title()),
            total_calls=r.call_count,
            total_tokens=int(r.tokens),
            input_tokens=int(r.in_tokens),
            output_tokens=int(r.out_tokens),
            avg_response_time_ms=int(r.avg_time),
        )
        for r in feat_res
    ]

    # 3. Top Users by Token Usage
    user_usage_query = (
        select(
            AIUsageLog.user_id,
            User.full_name,
            User.email,
            func.count(AIUsageLog.id).label("call_count"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("tokens"),
            func.max(AIUsageLog.created_at).label("last_used"),
        )
        .outerjoin(User, AIUsageLog.user_id == User.id)
        .group_by(AIUsageLog.user_id, User.full_name, User.email)
        .order_by(func.sum(AIUsageLog.total_tokens).desc())
        .limit(10)
    )
    user_usage_res = (await db.execute(user_usage_query)).all()
    top_users = [
        AIUserUsageStat(
            user_id=r.user_id or "anonymous",
            full_name=r.full_name or "Guest / System",
            email=r.email or "guest@prepcv.com",
            total_calls=r.call_count,
            total_tokens=int(r.tokens),
            last_used_at=r.last_used,
        )
        for r in user_usage_res
    ]

    # 4. Model Breakdown
    model_query = (
        select(
            AIUsageLog.model,
            func.count(AIUsageLog.id).label("call_count"),
            func.coalesce(func.sum(AIUsageLog.total_tokens), 0).label("tokens"),
        )
        .group_by(AIUsageLog.model)
        .order_by(func.sum(AIUsageLog.total_tokens).desc())
    )
    model_res = (await db.execute(model_query)).all()
    model_breakdown = [
        AIModelUsageStat(
            model=r.model or "Qwen2.5-Coder-32B",
            total_calls=r.call_count,
            total_tokens=int(r.tokens),
        )
        for r in model_res
    ]

    # 5. Recent Logs (Last 25 entries joined with User)
    recent_logs_query = (
        select(
            AIUsageLog.id,
            AIUsageLog.user_id,
            User.full_name.label("user_name"),
            User.email.label("user_email"),
            AIUsageLog.feature,
            AIUsageLog.model,
            AIUsageLog.input_tokens,
            AIUsageLog.output_tokens,
            AIUsageLog.total_tokens,
            AIUsageLog.response_time_ms,
            AIUsageLog.status,
            AIUsageLog.api_key_hint,
            AIUsageLog.error_message,
            AIUsageLog.created_at,
        )
        .outerjoin(User, AIUsageLog.user_id == User.id)
        .order_by(AIUsageLog.created_at.desc())
        .limit(25)
    )
    recent_logs_res = (await db.execute(recent_logs_query)).all()
    recent_logs = [
        AIUsageLogEntry(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user_name or "Guest / System",
            user_email=r.user_email or "guest@prepcv.com",
            feature=FEATURE_LABEL_MAP.get(r.feature, r.feature),
            model=r.model,
            input_tokens=r.input_tokens,
            output_tokens=r.output_tokens,
            total_tokens=r.total_tokens,
            response_time_ms=r.response_time_ms,
            status=r.status,
            api_key_hint=r.api_key_hint,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in recent_logs_res
    ]

    return AIUsageStats(
        total_calls=total_calls,
        total_input_tokens=total_input,
        total_output_tokens=total_output,
        total_tokens=total_tokens,
        avg_response_time_ms=avg_latency,
        active_keys_count=active_keys,
        total_keys_count=total_keys,
        feature_breakdown=feature_breakdown,
        top_users=top_users,
        model_breakdown=model_breakdown,
        recent_logs=recent_logs,
    )


# ─── User features for current user (used by frontend) ──────────────────────

async def get_current_user_features(db: AsyncSession, user_id: str) -> list[str]:
    """Get list of enabled feature keys for the current user.
    
    - Admin users get all active features.
    - Regular users get default core features (resume_generation, cv_upload)
      plus any explicitly granted features (ats_checker, interview_prep, etc.).
    """
    user_result = await db.execute(select(User.role).where(User.id == user_id))
    user_role = user_result.scalar()

    if user_role == "admin":
        features_result = await db.execute(
            select(Feature.key).where(Feature.is_active == True)
        )
        return [r[0] for r in features_result.all()]

    # Fetch all active features
    all_active_features = (
        await db.execute(select(Feature).where(Feature.is_active == True))
    ).scalars().all()

    # Fetch user specific overrides
    user_assignments = (
        await db.execute(select(UserFeature).where(UserFeature.user_id == user_id))
    ).scalars().all()
    overrides = {ua.feature_id: ua.is_enabled for ua in user_assignments}

    enabled_keys = []
    for f in all_active_features:
        if f.id in overrides:
            if overrides[f.id]:
                enabled_keys.append(f.key)
        else:
            # Default free features are enabled automatically
            if f.key in DEFAULT_FREE_FEATURES:
                enabled_keys.append(f.key)

    return enabled_keys


# ─── Helper Functions ────────────────────────────────────────────────────────

async def _get_user_activity(db: AsyncSession, user_id: str) -> UserActivityStats:
    """Get activity counts for a user."""
    resumes_count = (
        await db.execute(select(func.count(Resume.id)).where(Resume.user_id == user_id))
    ).scalar() or 0
    sessions_count = (
        await db.execute(select(func.count(InterviewSession.id)).where(InterviewSession.user_id == user_id))
    ).scalar() or 0
    feedbacks_count = (
        await db.execute(select(func.count(InterviewFeedback.id)).where(InterviewFeedback.user_id == user_id))
    ).scalar() or 0

    return UserActivityStats(
        resumes_count=resumes_count,
        interview_sessions_count=sessions_count,
        interview_feedbacks_count=feedbacks_count,
    )


async def _get_user_feature_infos(db: AsyncSession, user_id: str) -> list[UserFeatureInfo]:
    """Get feature assignments for a user with feature details across ALL registered features."""
    all_features = (
        await db.execute(select(Feature).order_by(Feature.name.asc()))
    ).scalars().all()

    user_assignments = (
        await db.execute(select(UserFeature).where(UserFeature.user_id == user_id))
    ).scalars().all()
    assignment_map = {ua.feature_id: ua for ua in user_assignments}

    feature_infos = []
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    for feature in all_features:
        if feature.id in assignment_map:
            ua = assignment_map[feature.id]
            feature_infos.append(
                UserFeatureInfo(
                    feature_id=feature.id,
                    feature_key=feature.key,
                    feature_name=feature.name,
                    is_enabled=ua.is_enabled,
                    granted_at=ua.granted_at,
                )
            )
        else:
            # Default core features are enabled by default, others disabled
            default_enabled = feature.key in DEFAULT_FREE_FEATURES
            feature_infos.append(
                UserFeatureInfo(
                    feature_id=feature.id,
                    feature_key=feature.key,
                    feature_name=feature.name,
                    is_enabled=default_enabled,
                    granted_at=now,
                )
            )

    return feature_infos

