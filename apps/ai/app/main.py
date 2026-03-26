from fastapi import FastAPI
from app.api.v2.router import api_router

app = FastAPI(
    title="Codinator AI API",
    description="AI 피드백 및 유사 코디 추천 API",
    version="0.2.0",
)

app.include_router(api_router, prefix="/api/v2")

@app.get("/")
def root():
    return {"message": "Welcome to Codinator AI API. Visit /docs for Swagger UI."}