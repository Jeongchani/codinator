from __future__ import annotations

from typing import Any

import numpy as np

from app.services.color_service import infer_dominant_color
from app.services.image_utils import clamp_bbox



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

    if label in {"top", "scarf", "belt"}:
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
    return []



def infer_style_tags(label: str, color: str) -> list[str]:
    tags = {"daily"}
    if color in {"black", "white", "gray", "navy", "beige"}:
        tags.add("minimal")
    if label in {"bag", "hat", "glasses", "jewelry", "scarf", "belt"}:
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
    if label == "bag":
        return "BAG"
    if label in {"hat", "scarf", "glasses", "belt", "jewelry"}:
        return "ACCESSORY"
    return "ETC"



def build_garment_responses(image_bgr: np.ndarray, parser_result: dict[str, Any]) -> list[dict[str, Any]]:
    height, width = image_bgr.shape[:2]
    garments: list[dict[str, Any]] = []

    for item in parser_result["garments"]:
        label = item["label"]
        mask = np.asarray(item["mask"], dtype=bool)
        bbox = clamp_bbox(item["bbox"], width, height)
        color = infer_dominant_color(image_bgr, mask=mask)
        category = map_label_to_category(label)

        garments.append(
            {
                "category": category,
                "confidence": round(float(item["confidence"]), 4),
                "bbox": bbox,
                "colorTags": [color],
                "fitTags": infer_fit_tags(category, label, bbox, height, width),
                "lengthTags": infer_length_tags(label, bbox, height),
                "materialTags": infer_material_tags(label, color),
                "styleTags": infer_style_tags(label, color),
                "seasonTags": infer_season_tags(label, color),
                "occasionTags": infer_occasion_tags(label),
                "parserLabel": label,
                "areaRatio": item["areaRatio"],
                "_mask": mask,
            }
        )

    return garments
