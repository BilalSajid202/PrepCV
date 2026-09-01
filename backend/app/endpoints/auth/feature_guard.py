"""
Feature guard dependency factory.

Provides a reusable dependency that checks if the current user has access
to a specific feature before allowing the endpoint to execute.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.admin import check_user_feature_access
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user


def require_feature(feature_key: str):
    """Dependency factory: returns a dependency that enforces feature access.

    Usage in a router:
        @router.post("/generate", dependencies=[Depends(require_feature("resume_generation"))])
        async def generate_resume(...):
            ...
    """

    async def _feature_guard(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db_session),
    ) -> User:
        has_access = await check_user_feature_access(db, current_user.id, feature_key)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to the '{feature_key}' feature. Please contact your administrator.",
            )
        return current_user

    return _feature_guard
