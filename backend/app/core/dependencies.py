from collections.abc import Generator

from app.core.config import Settings, get_settings


def get_app_settings() -> Settings:
    return get_settings()


def request_context() -> Generator[dict[str, str], None, None]:
    yield {"request_id": "not-set"}
