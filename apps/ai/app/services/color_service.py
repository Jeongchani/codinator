from __future__ import annotations

import cv2
import numpy as np

COLOR_PALETTE: dict[str, tuple[int, int, int]] = {
    "black": (25, 25, 25),
    "white": (240, 240, 240),
    "ivory": (236, 232, 215),
    "cream": (233, 223, 191),
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


def _refine_mask(mask: np.ndarray) -> np.ndarray:
    if mask.dtype != np.uint8:
        mask = mask.astype(np.uint8)
    kernel = np.ones((5, 5), dtype=np.uint8)
    refined = cv2.erode(mask, kernel, iterations=1)
    if int(refined.sum()) == 0:
        return mask
    return refined


def _robust_pixels(image_bgr: np.ndarray, mask: np.ndarray | None = None) -> np.ndarray:
    if mask is not None:
        refined_mask = _refine_mask(mask)
        pixels = image_bgr[refined_mask.astype(bool)]
        if pixels.size > 0:
            return pixels.astype(np.uint8)
    return image_bgr.reshape(-1, 3).astype(np.uint8)


def infer_dominant_color(image_bgr: np.ndarray, mask: np.ndarray | None = None) -> str:
    if image_bgr.size == 0:
        return "black"

    pixels = _robust_pixels(image_bgr, mask)
    if pixels.size == 0:
        return "black"

    hsv_pixels = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    lab_pixels = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)

    median_h = float(np.median(hsv_pixels[:, 0]))
    median_s = float(np.median(hsv_pixels[:, 1]))
    median_v = float(np.median(hsv_pixels[:, 2]))
    mean_l = float(np.mean(lab_pixels[:, 0]))
    mean_a = float(np.mean(lab_pixels[:, 1]))
    mean_b = float(np.mean(lab_pixels[:, 2]))

    # neutrals / light tones first
    if median_v < 42:
        return "black"

    if median_s < 18:
        if median_v >= 235:
            return "white"
        if median_v >= 215:
            if mean_b > 133:
                return "cream"
            if 126 <= mean_b <= 133:
                return "ivory"
            return "white"
        if median_v >= 190:
            if mean_b >= 138:
                return "beige"
            if mean_b >= 131:
                return "ivory"
            return "gray"
        return "gray"

    if median_s < 42 and median_v >= 180:
        if mean_b >= 142:
            return "beige"
        if mean_b >= 134:
            return "cream"
        if mean_b >= 129:
            return "ivory"

    if median_h < 10 or median_h >= 170:
        return "red"
    if median_h < 22:
        return "orange"
    if median_h < 34:
        return "yellow"
    if median_h < 85:
        return "green"
    if median_h < 130:
        return "blue"
    if median_h < 150:
        return "purple"
    if median_s < 75 and median_v < 190:
        return "brown"

    mean_bgr = pixels.mean(axis=0)
    mean_rgb = (float(mean_bgr[2]), float(mean_bgr[1]), float(mean_bgr[0]))

    def distance(color: tuple[int, int, int]) -> float:
        return ((mean_rgb[0] - color[0]) ** 2 + (mean_rgb[1] - color[1]) ** 2 + (mean_rgb[2] - color[2]) ** 2) ** 0.5

    return min(COLOR_PALETTE.items(), key=lambda item: distance(item[1]))[0]
