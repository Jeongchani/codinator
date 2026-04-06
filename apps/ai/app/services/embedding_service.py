from __future__ import annotations

from typing import Iterable

import numpy as np
import torch

from app.core.config import AI_ENABLE_EMBEDDING
from app.services.image_utils import rgb_to_pil
from app.services.model_registry import get_clip_model, get_clip_processor, get_torch_device


def _flatten_feature_array(value) -> np.ndarray:
    if isinstance(value, np.ndarray):
        array = value
    else:
        array = np.asarray(value)

    array = array.astype(np.float32)

    if array.size == 0:
        return np.zeros((0,), dtype=np.float32)

    return array.reshape(-1)


def _normalize(vector: np.ndarray) -> np.ndarray:
    vector = _flatten_feature_array(vector)

    if vector.size == 0:
        return vector

    norm = float(np.linalg.norm(vector))
    if norm <= 0.0:
        return vector

    return vector / norm


def _to_float_list(vector: np.ndarray) -> list[float]:
    vector = _flatten_feature_array(vector)
    return [round(float(value), 6) for value in vector.tolist()]


def _extract_feature_tensor(features) -> torch.Tensor:
    if isinstance(features, torch.Tensor):
        return features

    if hasattr(features, "image_embeds") and isinstance(features.image_embeds, torch.Tensor):
        return features.image_embeds

    if hasattr(features, "pooler_output") and isinstance(features.pooler_output, torch.Tensor):
        return features.pooler_output

    if hasattr(features, "last_hidden_state") and isinstance(features.last_hidden_state, torch.Tensor):
        # [batch, seq, hidden] -> mean pool
        return features.last_hidden_state.mean(dim=1)

    raise RuntimeError(
        f"fashion-clip output type is unsupported: {type(features).__name__}"
    )


def encode_image_embedding(rgb_image: np.ndarray) -> dict[str, object]:
    if not AI_ENABLE_EMBEDDING:
        return {
            "modelName": "patrickjohncyh/fashion-clip",
            "modelVersion": "disabled",
            "dimension": 0,
            "vector": [],
        }

    processor = get_clip_processor()
    model = get_clip_model()
    pil_image = rgb_to_pil(rgb_image)

    with torch.inference_mode():
        inputs = processor(images=pil_image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(get_torch_device())

        raw_features = model.get_image_features(pixel_values=pixel_values)
        feature_tensor = _extract_feature_tensor(raw_features)

        vector = feature_tensor.detach().float().cpu().numpy()

    vector = _normalize(vector)

    return {
        "modelName": "patrickjohncyh/fashion-clip",
        "modelVersion": model.config._name_or_path,
        "dimension": int(vector.shape[0]),
        "vector": _to_float_list(vector),
    }


def encode_many_image_embeddings(
    rgb_images: Iterable[np.ndarray],
    categories: Iterable[str],
) -> list[dict[str, object]]:
    if not AI_ENABLE_EMBEDDING:
        return []

    results: list[dict[str, object]] = []

    for category, rgb_image in zip(categories, rgb_images):
        embedding = encode_image_embedding(rgb_image)
        embedding["category"] = category
        results.append(embedding)

    return results