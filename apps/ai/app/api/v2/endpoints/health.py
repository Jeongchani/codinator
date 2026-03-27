from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import AI_ENV

router = APIRouter()


@router.get("")
def check_health():
    return {
        "success": True,
        "status": "ok",
        "service": "ai-api",
        "env": AI_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
