from fastapi import APIRouter, Depends

from app.business_logic.health import get_health_status
from app.core.config import Settings
from app.core.dependencies import get_app_settings

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
def health_check(settings: Settings = Depends(get_app_settings)) -> dict[str, str]:
    return get_health_status(settings)
