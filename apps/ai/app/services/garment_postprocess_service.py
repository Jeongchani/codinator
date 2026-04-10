from __future__ import annotations

from typing import Any

import numpy as np

from app.core.config import AI_GARMENT_MAX_ACCESSORY_ITEMS, AI_GARMENT_MAX_ITEMS
from app.services.color_service import infer_dominant_color
from app.services.image_utils import clamp_bbox

CATEGORY_PRIORITY = {
    "TOP": 90,
    "BOTTOM": 85,
    "DRESS": 80,
    "BAG": 70,
    "SHOES": 60,
    "ACCESSORY": 40,
    "ETC": 20,
}

COLOR_KO = {
    "black": "블랙",
    "white": "화이트",
    "gray": "그레이",
    "grey": "그레이",
    "navy": "네이비",
    "blue": "블루",
    "brown": "브라운",
    "beige": "베이지",
    "ivory": "아이보리",
    "cream": "크림",
    "red": "레드",
    "pink": "핑크",
    "green": "그린",
    "khaki": "카키",
}


def infer_fit_tags(category: str, label: str, bbox: list[int], image_height: int, image_width: int) -> list[str]:
    box_width = bbox[2] - bbox[0]
    width_ratio = box_width / max(1, image_width)

    if label in {"top", "dress"}:
        if width_ratio >= 0.45:
            return ["oversized"]
        if width_ratio <= 0.22:
            return ["slim"]
        return ["regular"]

    if label in {"pants", "skirt"}:
        if width_ratio >= 0.36:
            return ["wide"]
        if width_ratio <= 0.18:
            return ["slim"]
        return ["regular"]

    return []


def infer_length_tags(label: str, bbox: list[int], image_height: int) -> list[str]:
    height_ratio = (bbox[3] - bbox[1]) / max(1, image_height)

    if label in {"top", "scarf", "belt", "hat"}:
        return ["short"] if height_ratio < 0.22 else ["long"]
    if label in {"pants", "dress"}:
        return ["long"] if height_ratio >= 0.35 else ["short"]
    if label == "skirt":
        return ["long"] if height_ratio >= 0.24 else ["mini"]
    return []


def infer_material_tags(label: str, color: str) -> list[str]:
    if label == "pants":
        return ["denim"] if color in {"blue", "navy"} else ["cotton"]
    if label == "top":
        return ["knit"] if color in {"beige", "gray", "brown"} else ["cotton"]
    if label == "dress":
        return ["cotton"]
    if label == "bag":
        return ["leather"]
    if label == "shoes":
        return ["leather"]
    return []


def infer_style_tags(label: str, color: str) -> list[str]:
    tags = {"daily"}
    if color in {"black", "white", "gray", "navy", "beige"}:
        tags.add("minimal")
    if label in {"bag", "hat", "glasses", "jewelry", "scarf", "belt", "feet"}:
        tags.add("accent")
    if label in {"pants", "top", "dress", "skirt"}:
        tags.add("casual")
    return sorted(tags)


def infer_season_tags(label: str, color: str) -> list[str]:
    if label in {"scarf", "hat"}:
        return ["fall", "winter"]
    if color in {"black", "navy", "brown"}:
        return ["fall", "winter"]
    return ["spring", "summer"]


def infer_occasion_tags(label: str) -> list[str]:
    if label in {"bag", "jewelry", "glasses"}:
        return ["daily", "office"]
    return ["daily"]


def map_label_to_category(label: str) -> str:
    if label == "top":
        return "TOP"
    if label in {"pants", "skirt"}:
        return "BOTTOM"
    if label == "dress":
        return "DRESS"
    if label == "bag":
        return "BAG"
    if label == "feet":
        return "SHOES"
    if label in {"hat", "scarf", "glasses", "belt", "jewelry"}:
        return "ACCESSORY"
    return "ETC"


def _score_item(item: dict[str, Any]) -> float:
    category_bonus = CATEGORY_PRIORITY.get(item["category"], 0)
    return round((item["areaRatio"] * 1000.0) + (item["confidence"] * 100.0) + category_bonus, 4)


def _bbox_iou(a: list[int], b: list[int]) -> float:
    x1 = max(a[0], b[0])
    y1 = max(a[1], b[1])
    x2 = min(a[2], b[2])
    y2 = min(a[3], b[3])

    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter = inter_w * inter_h
    if inter <= 0:
        return 0.0

    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    union = area_a + area_b - inter
    if union <= 0:
        return 0.0
    return inter / union


def _should_keep_item(item: dict[str, Any], image_height: int) -> bool:
    label = item["parserLabel"]
    category = item["category"]
    area_ratio = float(item["areaRatio"])
    confidence = float(item["confidence"])
    box_height = item["bbox"][3] - item["bbox"][1]
    height_ratio = box_height / max(1, image_height)

    if category == "ACCESSORY":
        return confidence >= 0.18 and area_ratio >= 0.0025

    if category == "SHOES":
        return confidence >= 0.12 and area_ratio >= 0.003 and item["bbox"][1] >= int(image_height * 0.55)

    if label == "dress":
        return confidence >= 0.18 and area_ratio >= 0.03

    return confidence >= 0.15 and height_ratio >= 0.08


def _dedupe_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []

    for item in sorted(items, key=lambda entry: entry["_score"], reverse=True):
        duplicated = False
        for existing in kept:
            same_bucket = existing["category"] == item["category"]
            same_label = existing["parserLabel"] == item["parserLabel"]
            if (same_bucket or same_label) and _bbox_iou(existing["bbox"], item["bbox"]) >= 0.65:
                duplicated = True
                break
        if not duplicated:
            kept.append(item)

    return kept


def _limit_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    primary: list[dict[str, Any]] = []
    accessories: list[dict[str, Any]] = []

    used_primary_categories: set[str] = set()
    for item in sorted(items, key=lambda entry: entry["_score"], reverse=True):
        if item["category"] == "ACCESSORY":
            accessories.append(item)
            continue

        if item["category"] in used_primary_categories:
            continue

        used_primary_categories.add(item["category"])
        primary.append(item)

    accessories = accessories[:AI_GARMENT_MAX_ACCESSORY_ITEMS]
    limited = (primary + accessories)[:AI_GARMENT_MAX_ITEMS]
    limited.sort(key=lambda entry: entry["_score"], reverse=True)
    return limited


def build_garment_responses(image_bgr: np.ndarray, parser_result: dict[str, Any]) -> list[dict[str, Any]]:
    height, width = image_bgr.shape[:2]
    garments: list[dict[str, Any]] = []

    for item in parser_result["garments"]:
        label = item["label"]
        mask = np.asarray(item["mask"], dtype=bool)
        bbox = clamp_bbox(item["bbox"], width, height)
        color = infer_dominant_color(image_bgr, mask=mask)
        category = map_label_to_category(label)

        garment = {
            "category": category,
            "confidence": round(float(item["confidence"]), 4),
            "bbox": bbox,
            "dominantColor": color,
            "colorTags": [color],
            "fitTags": infer_fit_tags(category, label, bbox, height, width),
            "lengthTags": infer_length_tags(label, bbox, height),
            "materialTags": infer_material_tags(label, color),
            "styleTags": infer_style_tags(label, color),
            "seasonTags": infer_season_tags(label, color),
            "occasionTags": infer_occasion_tags(label),
            "parserLabel": label,
            "areaRatio": item["areaRatio"],
            "componentId": item.get("componentId"),
            "_mask": mask,
        }
        garment["_score"] = _score_item(garment)

        if _should_keep_item(garment, height):
            garments.append(garment)

    garments = _dedupe_items(garments)
    garments = _limit_items(garments)

    public: list[dict[str, Any]] = []
    for garment in garments:
        public.append(
            {
                "category": garment["category"],
                "confidence": garment["confidence"],
                "bbox": garment["bbox"],
                "dominantColor": garment["dominantColor"],
                "colorTags": garment["colorTags"],
                "fitTags": garment["fitTags"],
                "lengthTags": garment["lengthTags"],
                "materialTags": garment["materialTags"],
                "styleTags": garment["styleTags"],
                "seasonTags": garment["seasonTags"],
                "occasionTags": garment["occasionTags"],
                "_parserLabel": garment["parserLabel"],
                "_areaRatio": garment["areaRatio"],
                "_score": garment["_score"],
                "_componentId": garment.get("componentId"),
            }
        )

    return public


def build_caption_hint(garments: list[dict[str, Any]]) -> str:
    category_to_noun = {
        "TOP": "상의",
        "BOTTOM": "하의",
        "DRESS": "원피스",
        "BAG": "가방",
        "SHOES": "신발",
        "ACCESSORY": "액세서리",
        "ETC": "기타 아이템",
    }

    parts: list[str] = []
    for garment in garments[:3]:
        color = garment.get("colorTags", [""])[0]
        noun = category_to_noun.get(garment["category"], "아이템")
        color_ko = COLOR_KO.get(color, color)
        token = f"{color_ko} {noun}".strip()
        if token:
            parts.append(token)

    if not parts:
        return "착장 이미지"

    if len(parts) == 1:
        return f"{parts[0]}가 포함된 착장"

    return " / ".join(parts) + " 조합의 착장"
