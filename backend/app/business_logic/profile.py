from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import Profile, User
from app.schemas.profile import ProfileSchema


async def get_user_profile(db: AsyncSession, user_id: str) -> Optional[Profile]:
    """Fetch candidate profile by user ID."""
    stmt = select(Profile).where(Profile.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def save_or_update_profile(db: AsyncSession, user: User, profile_data: ProfileSchema) -> Profile:
    """Save or update candidate profile in DB."""
    existing_profile = await get_user_profile(db, user.id)

    dict_data = profile_data.model_dump()

    if existing_profile:
        existing_profile.personal_info = dict_data["personal_info"]
        existing_profile.experience = dict_data["experience"]
        existing_profile.education = dict_data["education"]
        existing_profile.skills = dict_data["skills"]
        existing_profile.projects = dict_data["projects"]
        existing_profile.certifications = dict_data["certifications"]
        profile = existing_profile
    else:
        profile = Profile(
            user_id=user.id,
            personal_info=dict_data["personal_info"],
            experience=dict_data["experience"],
            education=dict_data["education"],
            skills=dict_data["skills"],
            projects=dict_data["projects"],
            certifications=dict_data["certifications"],
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile
