import os
import time

import cv2
import numpy as np

from app.core.config import AI_BLUR_SIGMA, AI_FACE_MARGIN_RATIO
from app.core.errors import AppError
from app.services.file_service import get_content_type, get_encode_params, validate_extension

CASCADE_PATH = os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
FACE_CASCADE = cv2.CascadeClassifier(CASCADE_PATH)

if FACE_CASCADE.empty():
    raise RuntimeError(f"Failed to load face cascade: {CASCADE_PATH}")


def process_image(image_bytes: bytes, original_filename: str) -> dict:
    started_at = time.perf_counter()

    extension = validate_extension(original_filename)
    image = decode_image(image_bytes)
    height, width = image.shape[:2]

    faces = detect_faces(image)
    faces_detected = len(faces)

    if faces_detected == 0:
        return {
            "image_bytes": image_bytes,
            "content_type": get_content_type(extension),
            "extension": normalize_output_extension(extension),
            "faces_detected": 0,
            "blurred": False,
            "width": width,
            "height": height,
            "processing_ms": int((time.perf_counter() - started_at) * 1000),
        }

    output_image = image.copy()

    for (x, y, w, h) in faces:
        apply_face_blur(output_image, x, y, w, h)

    encoded_bytes, output_extension = encode_image(output_image, extension)

    return {
        "image_bytes": encoded_bytes,
        "content_type": get_content_type(output_extension),
        "extension": output_extension,
        "faces_detected": faces_detected,
        "blurred": True,
        "width": width,
        "height": height,
        "processing_ms": int((time.perf_counter() - started_at) * 1000),
    }


def decode_image(image_bytes: bytes):
    np_buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(np_buffer, cv2.IMREAD_COLOR)

    if image is None:
        raise AppError(
            status_code=400,
            code="INVALID_IMAGE_FILE",
            message="이미지를 디코딩할 수 없습니다.",
        )

    return image


def detect_faces(image) -> list[tuple[int, int, int, int]]:
    grayscale = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    detected = FACE_CASCADE.detectMultiScale(
        grayscale,
        scaleFactor=1.1,
        minNeighbors=7,
        minSize=(60, 60),
    )

    if len(detected) == 0:
        return []

    height, width = image.shape[:2]
    filtered: list[tuple[int, int, int, int]] = []

    for (x, y, w, h) in detected:
        x = int(x)
        y = int(y)
        w = int(w)
        h = int(h)

        center_y = y + (h / 2)
        aspect_ratio = w / max(h, 1)
        area_ratio = (w * h) / max(width * height, 1)

        if center_y > height * 0.62:
            continue

        if aspect_ratio < 0.7 or aspect_ratio > 1.4:
            continue

        if area_ratio < 0.002:
            continue

        filtered.append((x, y, w, h))

    return filtered


def apply_face_blur(image, x: int, y: int, w: int, h: int) -> None:
    margin_x = int(w * AI_FACE_MARGIN_RATIO)
    margin_y = int(h * AI_FACE_MARGIN_RATIO)

    x1 = max(0, x - margin_x)
    y1 = max(0, y - margin_y)
    x2 = min(image.shape[1], x + w + margin_x)
    y2 = min(image.shape[0], y + h + margin_y)

    apply_region_blur(image, x1, y1, x2, y2)


def apply_region_blur(image, x1: int, y1: int, x2: int, y2: int) -> None:
    if x2 <= x1 or y2 <= y1:
        return

    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return

    blurred_roi = cv2.GaussianBlur(
        roi,
        ksize=(0, 0),
        sigmaX=AI_BLUR_SIGMA,
        sigmaY=AI_BLUR_SIGMA,
    )

    roi_h, roi_w = roi.shape[:2]
    mask = np.zeros((roi_h, roi_w), dtype=np.uint8)

    center = (roi_w // 2, roi_h // 2)
    axes = (
        max(1, int(roi_w * 0.42)),
        max(1, int(roi_h * 0.52)),
    )

    cv2.ellipse(mask, center, axes, 0, 0, 360, 255, -1)

    feather_sigma = max(7, min(roi_w, roi_h) // 8)
    mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=feather_sigma, sigmaY=feather_sigma)
    mask = (mask.astype(np.float32) / 255.0)[..., None]

    blended = (
        roi.astype(np.float32) * (1.0 - mask)
        + blurred_roi.astype(np.float32) * mask
    ).astype(np.uint8)

    image[y1:y2, x1:x2] = blended


def encode_image(image, extension: str) -> tuple[bytes, str]:
    output_extension = normalize_output_extension(extension)
    encode_ext = ".jpg" if output_extension == "jpg" else f".{output_extension}"
    encode_params = get_encode_params(output_extension)

    success, encoded = cv2.imencode(encode_ext, image, encode_params)
    if not success:
        raise AppError(
            status_code=500,
            code="IMAGE_ENCODE_FAILED",
            message="블러 이미지를 인코딩하지 못했습니다.",
        )

    return encoded.tobytes(), output_extension


def normalize_output_extension(extension: str) -> str:
    return "jpg" if extension == "jpeg" else extension