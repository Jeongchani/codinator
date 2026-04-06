from __future__ import annotations

import cv2
import numpy as np

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



def infer_dominant_color(image_bgr: np.ndarray, mask: np.ndarray | None = None) -> str:
    if image_bgr.size == 0:
        return "black"

    working = image_bgr
    if mask is not None:
        if mask.dtype != np.bool_:
            mask = mask.astype(bool)
        pixels = working[mask]
        if pixels.size == 0:
            pixels = working.reshape(-1, 3)
    else:
        pixels = working.reshape(-1, 3)

    pixels = pixels.astype(np.uint8)
    hsv_pixels = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    mean_h, mean_s, mean_v = hsv_pixels.mean(axis=0)

    if mean_v < 45:
        return "black"
    if mean_s < 25 and mean_v > 210:
        return "white"
    if mean_s < 30:
        return "gray"
    if mean_h < 10 or mean_h >= 170:
        return "red"
    if mean_h < 22:
        return "orange"
    if mean_h < 34:
        return "yellow"
    if mean_h < 85:
        return "green"
    if mean_h < 130:
        return "blue"
    if mean_h < 150:
        return "purple"
    if mean_s < 75 and mean_v < 190:
        return "brown"

    mean_bgr = pixels.mean(axis=0)
    mean_rgb = (float(mean_bgr[2]), float(mean_bgr[1]), float(mean_bgr[0]))

    def distance(color: tuple[int, int, int]) -> float:
        return ((mean_rgb[0] - color[0]) ** 2 + (mean_rgb[1] - color[1]) ** 2 + (mean_rgb[2] - color[2]) ** 2) ** 0.5

    return min(COLOR_PALETTE.items(), key=lambda item: distance(item[1]))[0]
