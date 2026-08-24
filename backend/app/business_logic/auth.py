from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.database.models import User
from app.schemas.auth import UserLoginRequest, UserRegisterRequest


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Retrieve a user record by normalized email."""
    normalized_email = email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    return result.scalars().first()


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    """Retrieve a user record by unique ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()


async def register_user(db: AsyncSession, data: UserRegisterRequest) -> User:
    """Register a new candidate user after checking for duplicate email."""
    normalized_email = data.email.strip().lower()
    existing_user = await get_user_by_email(db, normalized_email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    hashed_pw = hash_password(data.password)
    user = User(
        full_name=data.full_name.strip(),
        email=normalized_email,
        hashed_password=hashed_pw,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(db: AsyncSession, data: UserLoginRequest) -> User:
    """Authenticate user credentials and return the user record."""
    normalized_email = data.email.strip().lower()
    user = await get_user_by_email(db, normalized_email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
