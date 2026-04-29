import asyncio

from fastapi import APIRouter, File, Response, UploadFile
from fastapi.concurrency import run_in_threadpool

from app.core.config import AI_MAX_UPLOAD_SIZE_BYTES, AI_MAX_UPLOAD_SIZE_MB, AI_PROCESS_TIMEOUT_SECONDS
from app.core.errors import AppError
from app.services.face_blur_service import process_image
from app.services.file_service import validate_extension

router = APIRouter()


@router.post("")
async def blur_face(
    image: UploadFile = File(...),
):
    if not image.filename:
        raise AppError(
            status_code=400,
            code="INVALID_FILE",
            message="파일명이 없습니다.",
        )

    validate_extension(image.filename)

    image_bytes = await image.read()
    await image.close()

    if not image_bytes:
        raise AppError(
            status_code=400,
            code="EMPTY_FILE",
            message="빈 파일입니다.",
        )

    if len(image_bytes) > AI_MAX_UPLOAD_SIZE_BYTES:
        raise AppError(
            status_code=413,
            code="FILE_TOO_LARGE",
            message=f"업로드 최대 크기는 {AI_MAX_UPLOAD_SIZE_MB}MB 입니다.",
            details={"max_upload_size_mb": AI_MAX_UPLOAD_SIZE_MB},
        )

    try:
        result = await asyncio.wait_for(
            run_in_threadpool(
                process_image,
                image_bytes,
                image.filename,
            ),
            timeout=AI_PROCESS_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise AppError(
            status_code=504,
            code="PROCESS_TIMEOUT",
            message=f"이미지 처리 시간이 {AI_PROCESS_TIMEOUT_SECONDS}초를 초과했습니다.",
            details={"timeout_seconds": AI_PROCESS_TIMEOUT_SECONDS},
        ) from exc

    return Response(
        content=result["image_bytes"],
        media_type=result["content_type"],
        headers={
            "X-AI-Faces-Detected": str(result["faces_detected"]),
            "X-AI-Blurred": "true" if result["blurred"] else "false",
            "X-AI-Width": str(result["width"]),
            "X-AI-Height": str(result["height"]),
            "X-AI-Processing-Ms": str(result["processing_ms"]),
        },
    )
