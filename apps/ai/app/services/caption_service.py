from __future__ import annotations

from typing import Any

import torch

from app.core.config import AI_ENABLE_CAPTION, AI_FLORENCE_MAX_NEW_TOKENS, AI_FLORENCE_PROMPT
from app.services.image_utils import rgb_to_pil
from app.services.model_registry import (
    get_florence_model,
    get_florence_processor,
    get_torch_device,
    get_torch_dtype,
)



def generate_caption(rgb_image) -> dict[str, Any]:
    if not AI_ENABLE_CAPTION:
        return {
            "text": "업로드된 착장 이미지",
            "modelName": "microsoft/Florence-2-base",
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

        generated_ids = model.generate(
            input_ids=input_ids,
            pixel_values=pixel_values,
            max_new_tokens=AI_FLORENCE_MAX_NEW_TOKENS,
            do_sample=False,
            num_beams=3,
        )

        generated_text = processor.batch_decode(generated_ids, skip_special_tokens=False)[0]

    parsed = processor.post_process_generation(
        generated_text,
        task=prompt,
        image_size=(pil_image.width, pil_image.height),
    )

    if isinstance(parsed, dict):
        caption = parsed.get(prompt)
        if isinstance(caption, str):
            text = caption
        else:
            text = generated_text
    else:
        text = str(parsed)

    text = text.replace(prompt, "").replace("</s>", "").strip()
    if not text:
        text = "업로드된 착장 이미지"

    return {
        "text": text,
        "modelName": "microsoft/Florence-2-base",
        "modelVersion": model.config._name_or_path,
    }
