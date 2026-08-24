from fastapi import FastAPI

from app.endpoints.health.router import router as health_router

app = FastAPI(title="PrepCV API", version="0.1.0")

app.include_router(health_router, prefix="/api")
