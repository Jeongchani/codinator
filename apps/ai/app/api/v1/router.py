from fastapi import APIRouter
from app.api.v1.endpoints import health

api_router = APIRouter()

# 헬스체크 엔드포인트 연결
api_router.include_router(health.router, prefix="/health", tags=["health"])