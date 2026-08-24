from app.business_logic.health import get_health_status
from app.core.config import Settings


def test_health_status() -> None:
    result = get_health_status(Settings(app_name="PrepCV API", environment="test"))

    assert result == {
        "status": "ok",
        "service": "PrepCV API",
        "environment": "test",
    }
