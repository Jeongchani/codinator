from __future__ import annotations

from typing import Any

import numpy as np

from app.core.config import AI_PARSER_MIN_AREA_RATIO, AI_PARSER_MIN_BOX_SIDE_PX
from app.services.image_utils import mask_to_bbox
from app.services.model_registry import get_parser_model

LABEL_ID_TO_NAME = {
    0: "background",
    1: "face",
    2: "hair",
    3: "top",
    4: "dress",
    5: "skirt",
    6: "pants",
    7: "belt",
    8: "bag",
    9: "hat",
    10: "scarf",
    11: "glasses",
    12: "arms",
    13: "hands",
    14: "legs",
    15: "feet",
    16: "torso",
    17: "jewelry",
}

TARGET_LABEL_IDS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 17]


def parse_image(rgb_image: np.ndarray) -> dict[str, Any]:
    parser = get_parser_model()

    logits = parser.predict(rgb_image, return_logits=True)
    if isinstance(logits, list):
        logits = logits[0]
    if logits.ndim == 4:
        logits = logits[0]

    logits = np.asarray(logits, dtype=np.float32)
    segmentation = np.argmax(logits, axis=0).astype(np.uint8)

    exp_logits = np.exp(logits - np.max(logits, axis=0, keepdims=True))
    probs = exp_logits / np.clip(np.sum(exp_logits, axis=0, keepdims=True), a_min=1e-8, a_max=None)

    height, width = segmentation.shape
    image_area = float(height * width)
    garments: list[dict[str, Any]] = []

    for label_id in TARGET_LABEL_IDS:
        mask = segmentation == label_id
        area = int(mask.sum())
        if area == 0:
            continue

        area_ratio = area / image_area
        if area_ratio < AI_PARSER_MIN_AREA_RATIO:
            continue

        bbox = mask_to_bbox(mask)
        if bbox is None:
            continue

        box_width = bbox[2] - bbox[0]
        box_height = bbox[3] - bbox[1]
        if box_width < AI_PARSER_MIN_BOX_SIDE_PX or box_height < AI_PARSER_MIN_BOX_SIDE_PX:
            continue

        confidence_map = probs[label_id]
        confidence = float(np.mean(confidence_map[mask])) if area > 0 else 0.0

        garments.append(
            {
                "labelId": label_id,
                "label": LABEL_ID_TO_NAME[label_id],
                "mask": mask,
                "bbox": bbox,
                "area": area,
                "areaRatio": round(area_ratio, 6),
                "confidence": round(confidence, 4),
            }
        )

    garments.sort(key=lambda item: item["area"], reverse=True)

    return {
        "segmentation": segmentation,
        "garments": garments,
    }
