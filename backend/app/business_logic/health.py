from app.core.config import Settings
from app.function_calls.text_calls import normalize_user_text


def get_health_status(settings: Settings) -> dict[str, str]:
    service_name = normalize_user_text(settings.app_name)
    return {"status": "ok", "service": service_name, "environment": settings.environment}
