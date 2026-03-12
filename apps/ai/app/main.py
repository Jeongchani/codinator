from fastapi import FastAPI
from app.api.v1.router import api_router

app = FastAPI(
    title="Codinator AI API",
    description="AI 피드백 및 유사 코디 추천 API",
    version="0.1.0",
)

# API 라우터 등록 (기획서 URL 규칙 /api/v1 에 맞춤)
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "Welcome to Codinator AI API. Visit /docs for Swagger UI."}