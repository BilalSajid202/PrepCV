from contextlib import asynccontextmanager
import logging
import sys

# Configure structured logging for the backend application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("prepcv")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import init_db
from app.endpoints.auth.router import router as auth_router
from app.endpoints.health.router import router as health_router
from app.endpoints.profile.router import router as profile_router
from app.endpoints.resume.router import router as resume_router
from app.endpoints.interview.router import router as interview_router
from app.endpoints.admin.router import router as admin_router


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

# Mount interview routes under both /interview and /api/interview
app.include_router(interview_router, prefix="/interview")
app.include_router(interview_router, prefix="/api/interview")

# Mount admin routes under both /admin and /api/admin
app.include_router(admin_router, prefix="/admin")
app.include_router(admin_router, prefix="/api/admin")
