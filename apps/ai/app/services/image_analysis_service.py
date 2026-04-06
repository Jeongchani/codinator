import time
from typing import Any

import cv2
import numpy as np

from app.core.errors import AppError
from app.services.face_blur_service import decode_image, detect_faces
from app.services.file_service import validate_extension

PIPELINE_VERSION = "scaffold-v1"
EMBEDDING_DIMENSION = 512
EMBEDDING_MODEL_NAME = "fashion-clip"
EMBEDDING_MODEL_VERSION = "scaffold-v1"
CAPTION_MODEL_NAME = "florence-2-base"
CAPTION_MODEL_VERSION = "scaffold-v1"
PARSER_MODEL_NAME = "fashn-human-parser"
PARSER_MODEL_VERSION = "scaffold-v1"

COLOR_PALETTE: dict[str, tuple[int, int, int]] = {
    "black": (25, 25, 25),
    "white": (235, 235, 235),
    "gray": (130, 130, 130),
    "red": (190, 55, 55),
    "orange": (220, 140, 60),
    "yellow": (220, 200, 80),
    "green": (70, 150, 80),
    "blue": (70, 110, 180),
    "navy": (40, 60, 110),
    "brown": (120, 85, 60),
    "beige": (210, 195, 160),
    "pink": (215, 150, 175),
    "purple": (140, 100, 165),
}


def analyze_image(image_bytes: bytes, original_filename: str) -> dict[str, Any]:
    started_at = time.perf_counter()

    validate_extension(original_filename)
    image = decode_image(image_bytes)
    height, width = image.shape[:2]

    if width < 32 or height < 32:
        raise AppError(
            status_code=400,
            code="IMAGE_TOO_SMALL",
            message="분석 가능한 최소 해상도보다 이미지가 작습니다.",
            details={"min_width": 32, "min_height": 32},
        )

    faces = detect_faces(image)
    garments = extract_garments(image)
    outfit_embedding = build_embedding(image)
    garment_embeddings = [
        {
            "category": garment["category"],
            "modelName": EMBEDDING_MODEL_NAME,
            "modelVersion": EMBEDDING_MODEL_VERSION,
            "dimension": EMBEDDING_DIMENSION,
            "vector": build_embedding(crop_image(image, garment["bbox"])),
        }
        for garment in garments
    ]

    caption = build_caption(garments)
    summary_tags = build_summary_tags(garments)

    return {
        "success": True,
        "pipelineVersion": PIPELINE_VERSION,
        "meta": {
            "scaffold": True,
            "parserModelName": PARSER_MODEL_NAME,
            "parserModelVersion": PARSER_MODEL_VERSION,
            "embedModelName": EMBEDDING_MODEL_NAME,
            "embedModelVersion": EMBEDDING_MODEL_VERSION,
            "captionModelName": CAPTION_MODEL_NAME,
            "captionModelVersion": CAPTION_MODEL_VERSION,
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
            "caption": caption,
            "summaryTags": summary_tags,
            "garments": garments,
        },
        "embeddings": {
            "outfit": {
                "modelName": EMBEDDING_MODEL_NAME,
                "modelVersion": EMBEDDING_MODEL_VERSION,
                "dimension": EMBEDDING_DIMENSION,
                "vector": outfit_embedding,
            },
            "garments": garment_embeddings,
        },
    }


def extract_garments(image: np.ndarray) -> list[dict[str, Any]]:
    height, width = image.shape[:2]
    garments: list[dict[str, Any]] = []

    # 임시 스캐폴드 분할: 전신 착장 이미지를 상/하/신발 비율로 잘라서 구조를 고정.
    layout = [
        ("TOP", 0.12, 0.48, ["regular"], ["long"], ["daily"]),
        ("BOTTOM", 0.48, 0.82, ["regular"], ["long"], ["daily"]),
        ("SHOES", 0.82, 0.98, [], [], ["daily"]),
    ]

    margin_x = max(8, int(width * 0.12))

    for index, (category, start_ratio, end_ratio, fit_tags, length_tags, occasion_tags) in enumerate(layout):
        y1 = int(height * start_ratio)
        y2 = int(height * end_ratio)
        x1 = margin_x
        x2 = max(margin_x + 1, width - margin_x)

        if y2 <= y1:
            continue

        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            continue

        dominant_color = infer_dominant_color(crop)
        style_tags = infer_style_tags(category, dominant_color)
        season_tags = infer_season_tags(category, dominant_color)
        material_tags = infer_material_tags(category)

        garments.append(
            {
                "category": category,
                "confidence": round(0.6 - index * 0.05, 2),
                "bbox": [x1, y1, x2, y2],
                "colorTags": [dominant_color],
                "fitTags": fit_tags,
                "lengthTags": length_tags,
                "materialTags": material_tags,
                "styleTags": style_tags,
                "seasonTags": season_tags,
                "occasionTags": occasion_tags,
            }
        )

    return garments


def crop_image(image: np.ndarray, bbox: list[int]) -> np.ndarray:
    x1, y1, x2, y2 = bbox
    return image[y1:y2, x1:x2]


def infer_dominant_color(image: np.ndarray) -> str:
    mean_bgr = image.mean(axis=(0, 1))
    mean_rgb = (float(mean_bgr[2]), float(mean_bgr[1]), float(mean_bgr[0]))

    def distance(color: tuple[int, int, int]) -> float:
        return ((mean_rgb[0] - color[0]) ** 2 + (mean_rgb[1] - color[1]) ** 2 + (mean_rgb[2] - color[2]) ** 2) ** 0.5

    return min(COLOR_PALETTE.items(), key=lambda item: distance(item[1]))[0]


def infer_style_tags(category: str, dominant_color: str) -> list[str]:
    tags = ["daily"]
    if dominant_color in {"black", "white", "gray", "navy", "beige"}:
        tags.append("minimal")
    if category == "SHOES":
        tags.append("casual")
    return sorted(set(tags))


def infer_season_tags(category: str, dominant_color: str) -> list[str]:
    if category == "SHOES":
        return ["spring", "fall"]
    if dominant_color in {"black", "navy", "brown"}:
        return ["fall", "winter"]
    return ["spring", "summer"]


def infer_material_tags(category: str) -> list[str]:
    if category == "TOP":
        return ["cotton"]
    if category == "BOTTOM":
        return ["denim"]
    if category == "SHOES":
        return ["leather"]
    return []


def build_caption(garments: list[dict[str, Any]]) -> str:
    if not garments:
        return "업로드된 착장 이미지"

    top = next((item for item in garments if item["category"] == "TOP"), None)
    bottom = next((item for item in garments if item["category"] == "BOTTOM"), None)

    if top and bottom:
        return f"{top['colorTags'][0]} 상의와 {bottom['colorTags'][0]} 하의를 매치한 데일리룩"
    if top:
        return f"{top['colorTags'][0]} 상의 중심의 착장 이미지"
    return "업로드된 착장 이미지"


def build_summary_tags(garments: list[dict[str, Any]]) -> list[str]:
    tags = {"daily"}
    for garment in garments:
        tags.update(garment.get("styleTags", []))
        tags.update(garment.get("seasonTags", []))
    return sorted(tags)


def build_embedding(image: np.ndarray) -> list[float]:
    if image.size == 0:
        return [0.0] * EMBEDDING_DIMENSION

    resized = cv2.resize(image, (32, 16), interpolation=cv2.INTER_AREA)
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    vector = rgb.astype(np.float32).reshape(-1) / 255.0

    if vector.size < EMBEDDING_DIMENSION:
        vector = np.pad(vector, (0, EMBEDDING_DIMENSION - vector.size))
    elif vector.size > EMBEDDING_DIMENSION:
        vector = vector[:EMBEDDING_DIMENSION]

    norm = float(np.linalg.norm(vector))
    if norm > 0:
        vector = vector / norm

    return [round(float(value), 6) for value in vector.tolist()]
