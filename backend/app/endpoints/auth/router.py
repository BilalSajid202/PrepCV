from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_logic.auth import authenticate_user, register_user
from app.core.security import create_access_token
from app.database.models import User
from app.database.session import get_db_session
from app.endpoints.auth.deps import get_current_user
from app.schemas.auth import TokenResponse, UserLoginRequest, UserRegisterRequest, UserResponse

router = APIRouter(tags=["auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="prepcv_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True in HTTPS production environments
        max_age=60 * 60 * 24 * 7,  # 7 days
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Register a new candidate user and return access token & user profile."""
    user = await register_user(db, data)
    token = create_access_token(subject=user.id)
    _set_auth_cookie(response, token)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    data: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    """Authenticate candidate user and return access token & user profile."""
    user = await authenticate_user(db, data)
    token = create_access_token(subject=user.id)
    _set_auth_cookie(response, token)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Get profile of currently logged-in user."""
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    """Clear authentication session cookie."""
    response.delete_cookie(key="prepcv_token")
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}
