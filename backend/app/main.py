from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.session import init_db
from app.endpoints.auth.router import router as auth_router
from app.endpoints.health.router import router as health_router


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
