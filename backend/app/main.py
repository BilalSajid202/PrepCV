from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import init_db
from app.endpoints.auth.router import router as auth_router
from app.endpoints.health.router import router as health_router
from app.endpoints.profile.router import router as profile_router
from app.endpoints.resume.router import router as resume_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup database initialization
    await init_db()
    yield


app = FastAPI(
    title="PrepCV API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount health routes
app.include_router(health_router, prefix="")
app.include_router(health_router, prefix="/api")

# Mount auth routes under both /auth and /api/auth
app.include_router(auth_router, prefix="/auth")
app.include_router(auth_router, prefix="/api/auth")

# Mount profile routes under both /profile and /api/profile
app.include_router(profile_router, prefix="/profile")
app.include_router(profile_router, prefix="/api/profile")

# Mount resume routes under both /resumes and /api/resumes
app.include_router(resume_router, prefix="/resumes")
app.include_router(resume_router, prefix="/api/resumes")

