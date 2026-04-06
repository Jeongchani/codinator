from fastapi import APIRouter
from app.api.v2.endpoints import analyze_image, blur_face, health

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(blur_face.router, prefix="/blur-face", tags=["blur-face"])
api_router.include_router(analyze_image.router, prefix="/analyze-image", tags=["analyze-image"])
