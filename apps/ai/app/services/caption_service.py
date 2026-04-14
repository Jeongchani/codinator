from __future__ import annotations

from typing import Any

import torch

from app.core.config import (
    AI_ENABLE_CAPTION,
    AI_FLORENCE_MAX_NEW_TOKENS,
    AI_FLORENCE_MODEL_ID,
    AI_FLORENCE_PROMPT,
)
from app.services.garment_postprocess_service import build_caption_hint
from app.services.image_utils import rgb_to_pil
from app.services.model_registry import (
    get_florence_model,
    get_florence_processor,
    get_torch_device,
    get_torch_dtype,
)

EN_KO_TOKEN_MAP = {
    "dress": "원피스",
    "shirt": "셔츠",
    "jacket": "재킷",
    "coat": "코트",
    "bag": "가방",
    "shoes": "신발",
    "pants": "팬츠",
    "skirt": "스커트",
    "hat": "모자",
    "glasses": "안경",
    "scarf": "머플러",
    "jewelry": "주얼리",
    "black": "블랙",
    "white": "화이트",
    "blue": "블루",
    "navy": "네이비",
    "gray": "그레이",
    "brown": "브라운",
    "beige": "베이지",
}


def _extract_caption_text(parsed: Any, prompt: str, fallback_text: str) -> str:
    if isinstance(parsed, dict):
        value = parsed.get(prompt)
        if isinstance(value, str):
            return value.strip()
        if isinstance(value, dict):
            for item in value.values():
                if isinstance(item, str) and item.strip():
                    return item.strip()

    if isinstance(parsed, str) and parsed.strip():
        return parsed.strip()

    text = fallback_text.replace(prompt, "").replace("</s>", "").strip()
    return text or "uploaded outfit image"


def _translate_caption_fallback(raw_text: str) -> str:
    translated = raw_text.strip().lower()
    for source, target in EN_KO_TOKEN_MAP.items():
        translated = translated.replace(source, target)

    translated = translated.strip()
    if not translated:
        return "착장 이미지"

    if translated.endswith("."):
        translated = translated[:-1]

    return translated + " 착장"


def generate_caption(rgb_image) -> dict[str, Any]:
    if not AI_ENABLE_CAPTION:
        return {
            "text": "업로드된 착장 이미지",
            "rawText": "uploaded outfit image",
            "modelName": AI_FLORENCE_MODEL_ID,
            "modelVersion": "disabled",
        }

    processor = get_florence_processor()
    model = get_florence_model()
    pil_image = rgb_to_pil(rgb_image)

    device = get_torch_device()
    dtype = get_torch_dtype()
    prompt = AI_FLORENCE_PROMPT

    with torch.inference_mode():
        inputs = processor(text=prompt, images=pil_image, return_tensors="pt")

        input_ids = inputs["input_ids"].to(device)
        pixel_values = inputs["pixel_values"].to(device, dtype)
        attention_mask = inputs.get("attention_mask")
        if attention_mask is not None:
            attention_mask = attention_mask.to(device)

        generated_ids = model.generate(
            input_ids=input_ids,
            pixel_values=pixel_values,
            attention_mask=attention_mask,
            max_new_tokens=AI_FLORENCE_MAX_NEW_TOKENS,
            do_sample=False,
            num_beams=3,
            use_cache=False,
        )

        generated_text = processor.batch_decode(
            generated_ids,
            skip_special_tokens=False,
        )[0]

    parsed = processor.post_process_generation(
        generated_text,
        task=prompt,
        image_size=(pil_image.width, pil_image.height),
    )

    raw_text = _extract_caption_text(parsed, prompt, generated_text)

    return {
        "text": _translate_caption_fallback(raw_text),
        "rawText": raw_text,
        "modelName": AI_FLORENCE_MODEL_ID,
        "modelVersion": model.config._name_or_path,
    }


def build_service_caption(raw_text: str, garments: list[dict[str, Any]]) -> str:
    hint = build_caption_hint(garments)
    if garments:
        return hint

    return _translate_caption_fallback(raw_text)
