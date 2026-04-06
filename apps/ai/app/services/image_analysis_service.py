import time
from typing import Any

import cv2
import numpy as np

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
from app.services.caption_service import generate_caption
from app.services.embedding_service import encode_image_embedding, encode_many_image_embeddings
from app.services.face_blur_service import decode_image, detect_faces
from app.services.file_service import validate_extension
from app.services.garment_postprocess_service import build_garment_responses
from app.services.image_utils import bgr_to_rgb, crop_image, resize_longest_side
from app.services.parser_service import parse_image

PIPELINE_VERSION = "ai-real-models-v1"



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

    caption_result = generate_caption(image_rgb)

    outfit_embedding = encode_image_embedding(image_rgb)

    garment_crops_rgb = []
    garment_categories = []
    for garment in garments:
        crop_bgr = crop_image(image_bgr, garment["bbox"])
        if crop_bgr.size == 0:
            continue
        garment_crops_rgb.append(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
        garment_categories.append(garment["category"])

    garment_embeddings = encode_many_image_embeddings(garment_crops_rgb, garment_categories)

    public_garments = []
    for garment in garments:
        public_garments.append(
            {
                "category": garment["category"],
                "confidence": garment["confidence"],
                "bbox": garment["bbox"],
                "colorTags": garment["colorTags"],
                "fitTags": garment["fitTags"],
                "lengthTags": garment["lengthTags"],
                "materialTags": garment["materialTags"],
                "styleTags": garment["styleTags"],
                "seasonTags": garment["seasonTags"],
                "occasionTags": garment["occasionTags"],
            }
        )

    summary_tags = build_summary_tags(public_garments)

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
            "processingMs": int((time.perf_counter() - started_at) * 1000),
        },
        "image": {
            "width": width,
            "height": height,
        },
        "blur": {
            "facesDetected": len(faces),
            "blurred": len(faces) > 0,
        },
        "analysis": {
            "caption": caption_result["text"],
            "summaryTags": summary_tags,
            "garments": public_garments,
        },
        "embeddings": {
            "outfit": outfit_embedding,
            "garments": garment_embeddings,
        },
    }



def build_summary_tags(garments: list[dict[str, Any]]) -> list[str]:
    tags = {"daily"}
    for garment in garments:
        tags.update(garment.get("styleTags", []))
        tags.update(garment.get("seasonTags", []))
        tags.update(garment.get("occasionTags", []))
    return sorted(tags)
