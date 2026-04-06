from fastapi import APIRouter
from app.api.v2.endpoints import blur_face, health

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(blur_face.router, prefix="/blur-face", tags=["blur-face"])
