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



def get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}



def get_str(name: str, default: str) -> str:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


AI_ENV = os.getenv("AI_ENV", "development")
AI_PORT = get_int("AI_PORT", 8000)

AI_MAX_UPLOAD_SIZE_MB = get_int("AI_MAX_UPLOAD_SIZE_MB", 10)
AI_MAX_UPLOAD_SIZE_BYTES = AI_MAX_UPLOAD_SIZE_MB * 1024 * 1024

AI_PROCESS_TIMEOUT_SECONDS = get_int("AI_PROCESS_TIMEOUT_SECONDS", 60)

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

AI_MODEL_DEVICE = get_str("AI_MODEL_DEVICE", "auto")
AI_HF_HOME = get_str("AI_HF_HOME", "")
AI_HF_TOKEN = get_str("AI_HF_TOKEN", "")
AI_ENABLE_PARSER = get_bool("AI_ENABLE_PARSER", True)
AI_ENABLE_EMBEDDING = get_bool("AI_ENABLE_EMBEDDING", True)
AI_ENABLE_CAPTION = get_bool("AI_ENABLE_CAPTION", True)

AI_PARSER_MODEL_ID = get_str("AI_PARSER_MODEL_ID", "fashn-ai/fashn-human-parser")
AI_FASHION_CLIP_MODEL_ID = get_str("AI_FASHION_CLIP_MODEL_ID", "patrickjohncyh/fashion-clip")
AI_FLORENCE_MODEL_ID = get_str("AI_FLORENCE_MODEL_ID", "microsoft/Florence-2-base")

AI_PARSER_MIN_AREA_RATIO = get_float("AI_PARSER_MIN_AREA_RATIO", 0.005)
AI_PARSER_MIN_BOX_SIDE_PX = get_int("AI_PARSER_MIN_BOX_SIDE_PX", 24)
AI_PARSER_MIN_CONFIDENCE = get_float("AI_PARSER_MIN_CONFIDENCE", 0.12)
AI_PARSER_ENABLE_FEET_AS_SHOES = get_bool("AI_PARSER_ENABLE_FEET_AS_SHOES", True)
AI_GARMENT_MAX_ITEMS = get_int("AI_GARMENT_MAX_ITEMS", 6)
AI_GARMENT_MAX_ACCESSORY_ITEMS = get_int("AI_GARMENT_MAX_ACCESSORY_ITEMS", 2)
AI_IMAGE_MAX_SIDE = get_int("AI_IMAGE_MAX_SIDE", 1280)
AI_FLORENCE_PROMPT = get_str("AI_FLORENCE_PROMPT", "<DETAILED_CAPTION>")
AI_FLORENCE_MAX_NEW_TOKENS = get_int("AI_FLORENCE_MAX_NEW_TOKENS", 128)
