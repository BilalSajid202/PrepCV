from collections.abc import AsyncGenerator
from typing import Optional
import logging

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.database.models import Base

logger = logging.getLogger("prepcv")

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        db_url = get_settings().database_url
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        _engine = create_async_engine(db_url, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return _session_factory


from sqlalchemy import text


# Default features that are seeded on startup
DEFAULT_FEATURES = [
    {"key": "resume_generation", "name": "Resume Generation", "description": "Generate ATS-optimized resumes from candidate profile data"},
    {"key": "ats_checker", "name": "ATS Checker", "description": "Score resumes against job descriptions for ATS compatibility"},
    {"key": "interview_prep", "name": "Interview Prep", "description": "Generate tailored interview questions based on company and role"},
    {"key": "interview_feedback", "name": "Interview Feedback", "description": "Submit and browse real interview questions for community learning"},
    {"key": "cv_upload", "name": "CV Upload & Parse", "description": "Upload PDF/DOCX CVs and auto-extract profile data"},
    {"key": "ai_improve", "name": "AI Improve Bullets", "description": "Use AI to rewrite and improve resume bullet points"},
]


async def init_db() -> None:
    """Initialize database tables and run lightweight idempotent schema migrations."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotently ensure columns added in Step 5 & 6 exist
        await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;"))
        await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS target_jd TEXT;"))
        await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS ats_score INTEGER;"))
        await conn.execute(text("ALTER TABLE resumes ADD COLUMN IF NOT EXISTS ats_feedback JSON;"))
        # Admin panel columns on users table
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;"))

    # Seed default features (idempotent — skip if key already exists)
    factory = get_session_factory()
    async with factory() as session:
        for feat in DEFAULT_FEATURES:
            existing = await session.execute(
                text("SELECT id FROM features WHERE key = :key"), {"key": feat["key"]}
            )
            if existing.first() is None:
                await session.execute(
                    text(
                        "INSERT INTO features (id, key, name, description, is_active, created_at) "
                        "VALUES (gen_random_uuid()::text, :key, :name, :description, TRUE, NOW())"
                    ),
                    feat,
                )
                logger.info(f"Seeded default feature: {feat['name']}")
        await session.commit()


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide async database session dependency."""
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def close_db_engine() -> None:
    """Close engine connections cleanly."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None

