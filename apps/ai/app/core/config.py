import os
from dotenv import load_dotenv

load_dotenv()


def get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return int(value)


def get_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return float(value)


AI_ENV = os.getenv("AI_ENV", "development")
AI_PORT = get_int("AI_PORT", 8000)

AI_MAX_UPLOAD_SIZE_MB = get_int("AI_MAX_UPLOAD_SIZE_MB", 10)
AI_MAX_UPLOAD_SIZE_BYTES = AI_MAX_UPLOAD_SIZE_MB * 1024 * 1024

AI_PROCESS_TIMEOUT_SECONDS = get_int("AI_PROCESS_TIMEOUT_SECONDS", 15)

AI_ALLOWED_EXTENSIONS = {
    item.strip().lower().lstrip(".")
    for item in os.getenv("AI_ALLOWED_EXTENSIONS", "jpg,jpeg,png,webp").split(",")
    if item.strip()
}

AI_CORS_ALLOW_ORIGINS = [
    item.strip()
    for item in os.getenv(
        "AI_CORS_ALLOW_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if item.strip()
]

AI_BLUR_SIGMA = get_int("AI_BLUR_SIGMA", 25)
AI_FACE_MARGIN_RATIO = get_float("AI_FACE_MARGIN_RATIO", 0.25)
