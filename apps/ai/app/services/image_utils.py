from __future__ import annotations

from io import BytesIO

import cv2
import numpy as np
from PIL import Image



def bgr_to_rgb(image: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)



def rgb_to_pil(image: np.ndarray) -> Image.Image:
    return Image.fromarray(image.astype(np.uint8), mode="RGB")



def image_to_png_bytes(image: np.ndarray) -> bytes:
    pil = rgb_to_pil(image)
    buffer = BytesIO()
    pil.save(buffer, format="PNG")
    return buffer.getvalue()



def resize_longest_side(image: np.ndarray, max_side: int) -> np.ndarray:
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return image

    ratio = max_side / float(longest)
    resized_width = max(1, int(round(width * ratio)))
    resized_height = max(1, int(round(height * ratio)))
    return cv2.resize(image, (resized_width, resized_height), interpolation=cv2.INTER_AREA)



def crop_image(image: np.ndarray, bbox: list[int]) -> np.ndarray:
    x1, y1, x2, y2 = clamp_bbox(bbox, image.shape[1], image.shape[0])
    return image[y1:y2, x1:x2]



def clamp_bbox(bbox: list[int] | tuple[int, int, int, int], width: int, height: int) -> list[int]:
    x1, y1, x2, y2 = bbox
    x1 = max(0, min(int(x1), width - 1))
    y1 = max(0, min(int(y1), height - 1))
    x2 = max(x1 + 1, min(int(x2), width))
    y2 = max(y1 + 1, min(int(y2), height))
    return [x1, y1, x2, y2]



def mask_to_bbox(mask: np.ndarray) -> list[int] | None:
    ys, xs = np.where(mask)
    if xs.size == 0 or ys.size == 0:
        return None
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
