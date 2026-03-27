from pathlib import Path

import cv2

from app.core.config import AI_ALLOWED_EXTENSIONS
from app.core.errors import AppError


def get_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower().lstrip(".")
    if not ext:
        raise AppError(
            status_code=400,
            code="INVALID_FILE_EXTENSION",
            message="파일 확장자가 없습니다.",
        )
    return ext


def validate_extension(filename: str) -> str:
    ext = get_extension(filename)
    if ext not in AI_ALLOWED_EXTENSIONS:
        raise AppError(
            status_code=400,
            code="UNSUPPORTED_FILE_EXTENSION",
            message=f"허용되지 않은 확장자입니다. 허용 확장자: {sorted(AI_ALLOWED_EXTENSIONS)}",
            details={"allowed_extensions": sorted(AI_ALLOWED_EXTENSIONS)},
        )
    return ext


def get_content_type(extension: str) -> str:
    normalized = "jpg" if extension == "jpeg" else extension

    if normalized == "jpg":
        return "image/jpeg"
    if normalized == "png":
        return "image/png"
    if normalized == "webp":
        return "image/webp"

    raise AppError(
        status_code=400,
        code="UNSUPPORTED_FILE_EXTENSION",
        message=f"지원하지 않는 확장자입니다: {extension}",
    )


def get_encode_params(extension: str) -> list[int]:
    normalized = "jpg" if extension == "jpeg" else extension

    if normalized == "jpg":
        return [int(cv2.IMWRITE_JPEG_QUALITY), 95]
    if normalized == "png":
        return [int(cv2.IMWRITE_PNG_COMPRESSION), 3]
    if normalized == "webp":
        return [int(cv2.IMWRITE_WEBP_QUALITY), 95]
    return []
