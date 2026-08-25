from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PrepCV API"
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:bilal202sajid@localhost:5432/prepcv"
    gemini_api_key: str = ""
    xai_api_key: str = ""
    secret_key: str = "prepcv-secret-key-change-in-production-super-secure-32chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()

