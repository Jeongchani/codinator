from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/")
def check_health():
    return {
        "status": "ok",
        "service": "ai-api",
        "timestamp": datetime.utcnow().isoformat()
    }