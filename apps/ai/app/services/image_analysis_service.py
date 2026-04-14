import logging
import time
from typing import Any

import cv2

from app.core.config import (
    AI_ENABLE_CAPTION,
    AI_ENABLE_EMBEDDING,
    AI_ENABLE_PARSER,
    AI_FASHION_CLIP_MODEL_ID,
    AI_FLORENCE_MODEL_ID,
    AI_IMAGE_MAX_SIDE,
    AI_PARSER_MODEL_ID,
)
from app.core.errors import AppError
from app.services.caption_service import build_service_caption, generate_caption
from app.services.embedding_service import encode_image_embedding, encode_many_image_embeddings
from app.services.face_blur_service import decode_image, detect_faces
from app.services.file_service import validate_extension
from app.services.garment_postprocess_service import build_garment_responses
from app.services.image_utils import bgr_to_rgb, crop_image, resize_longest_side
from app.services.parser_service import parse_image

PIPELINE_VERSION = "ai-real-models-v2.3"

logger = logging.getLogger(__name__)


def analyze_image(image_bytes: bytes, original_filename: str) -> dict[str, Any]:
    started_at = time.perf_counter()

    validate_extension(original_filename)
    image_bgr = decode_image(image_bytes)
    image_bgr = resize_longest_side(image_bgr, AI_IMAGE_MAX_SIDE)
    height, width = image_bgr.shape[:2]

    if width < 32 or height < 32:
        raise AppError(
            status_code=400,
            code="IMAGE_TOO_SMALL",
            message="분석 가능한 최소 해상도보다 이미지가 작습니다.",
            details={"min_width": 32, "min_height": 32},
        )

    faces = detect_faces(image_bgr)
    image_rgb = bgr_to_rgb(image_bgr)

    garments: list[dict[str, Any]] = []
    if AI_ENABLE_PARSER:
        parser_result = parse_image(image_rgb)
        garments = build_garment_responses(image_bgr, parser_result)

    caption_fallback_used = False
    warnings: list[str] = []
    try:
        caption_result = generate_caption(image_rgb)
    except Exception:
        logger.exception("caption generation failed; using fallback caption")
        caption_fallback_used = True
        warnings.append("caption_failed")
        caption_result = {
            "text": "업로드된 착장 이미지",
            "rawText": "uploaded outfit image",
            "modelName": AI_FLORENCE_MODEL_ID,
            "modelVersion": "failed",
        }

    localized_caption = build_service_caption(caption_result.get("rawText", ""), garments)

    outfit_embedding = encode_image_embedding(image_rgb)

    garment_crops_rgb = []
    garment_categories = []
    visible_garments: list[dict[str, Any]] = []
    for garment in garments:
        crop_bgr = crop_image(image_bgr, garment["bbox"])
        if crop_bgr.size == 0:
            continue
        garment_crops_rgb.append(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
        garment_categories.append(garment["category"])
        visible_garments.append(garment)

    garment_embeddings = encode_many_image_embeddings(garment_crops_rgb, garment_categories)

    summary_tags = build_summary_tags(visible_garments)

    return {
        "success": True,
        "pipelineVersion": PIPELINE_VERSION,
        "meta": {
            "scaffold": False,
            "parserModelName": AI_PARSER_MODEL_ID,
            "parserModelVersion": AI_PARSER_MODEL_ID if AI_ENABLE_PARSER else "disabled",
            "embedModelName": AI_FASHION_CLIP_MODEL_ID,
            "embedModelVersion": outfit_embedding["modelVersion"] if AI_ENABLE_EMBEDDING else "disabled",
            "captionModelName": AI_FLORENCE_MODEL_ID,
            "captionModelVersion": caption_result["modelVersion"] if AI_ENABLE_CAPTION else "disabled",
            "captionFallbackUsed": caption_fallback_used,
            "warnings": warnings,
            "processingMs": int((time.perf_counter() - started_at) * 1000),
        },
        "image": {
            "width": width,
            "height": height,
        },
        "blur": {
            "facesDetected": len(faces),
            "blurred": False,
        },
        "analysis": {
            "caption": localized_caption,
            "summaryTags": summary_tags,
            "garments": [strip_internal_fields(garment) for garment in visible_garments],
        },
        "embeddings": {
            "outfit": outfit_embedding,
            "garments": garment_embeddings,
        },
    }


def strip_internal_fields(garment: dict[str, Any]) -> dict[str, Any]:
    return {
        "category": garment["category"],
        "normalizedCategory": garment["category"],
        "parserLabel": garment.get("_parserLabel"),
        "confidence": garment["confidence"],
        "bbox": garment["bbox"],
        "dominantColor": garment.get("dominantColor"),
        "areaRatio": garment.get("_areaRatio"),
        "colorTags": garment["colorTags"],
        "fitTags": garment["fitTags"],
        "lengthTags": garment["lengthTags"],
        "materialTags": garment["materialTags"],
        "styleTags": garment["styleTags"],
        "seasonTags": garment["seasonTags"],
        "occasionTags": garment["occasionTags"],
    }


def build_summary_tags(garments: list[dict[str, Any]]) -> list[str]:
    tags = {"daily"}
    categories = {garment["category"] for garment in garments}

    if "TOP" in categories:
        tags.add("top")
    if "BOTTOM" in categories:
        tags.add("bottom")
    if "BAG" in categories:
        tags.add("bag")
    if "SHOES" in categories:
        tags.add("shoes")
    if "ACCESSORY" in categories:
        tags.add("accessory")
    if "DRESS" in categories:
        tags.add("onepiece")
    if "ETC" in categories:
        tags.add("etc")

    for garment in garments:
        tags.update(garment.get("styleTags", []))
        tags.update(garment.get("seasonTags", []))
        tags.update(garment.get("occasionTags", []))
        dominant_color = garment.get("dominantColor") or next(iter(garment.get("colorTags", [])), None)
        if dominant_color:
            tags.add(dominant_color)

    return sorted(tags)