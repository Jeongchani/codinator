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
    "khaki": (132, 128, 82),
}


def _refine_mask(mask: np.ndarray) -> np.ndarray:
    if mask.dtype != np.uint8:
        mask = mask.astype(np.uint8)

    mask = (mask > 0).astype(np.uint8)

    kernel = np.ones((5, 5), dtype=np.uint8)
    opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=1)

    if int(closed.sum()) == 0:
        closed = mask

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(closed, connectivity=8)
    if num_labels <= 1:
        return closed

    largest_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    refined = (labels == largest_label).astype(np.uint8)

    if int(refined.sum()) == 0:
        return closed
    return refined


def _robust_pixels(image_bgr: np.ndarray, mask: np.ndarray | None = None) -> np.ndarray:
    if mask is not None:
        refined_mask = _refine_mask(mask)
        pixels = image_bgr[refined_mask.astype(bool)]
        if pixels.size > 0:
            return pixels.astype(np.uint8)
    return image_bgr.reshape(-1, 3).astype(np.uint8)


def _rgb_to_lab_color(rgb: tuple[int, int, int]) -> np.ndarray:
    arr = np.array([[rgb]], dtype=np.uint8)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)


def _lab_distance_to_palette(lab_color: np.ndarray, names: list[str]) -> str:
    def distance(name: str) -> float:
        palette_lab = _rgb_to_lab_color(COLOR_PALETTE[name])
        return float(np.linalg.norm(lab_color - palette_lab))

    return min(names, key=distance)


def _choose_representative_cluster(pixels: np.ndarray) -> np.ndarray:
    if len(pixels) < 24:
        return pixels.mean(axis=0).astype(np.float32)

    sample = pixels.astype(np.float32)
    k = min(3, len(sample))
    criteria = (
        cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER,
        20,
        1.0,
    )

    try:
        _compactness, labels, centers = cv2.kmeans(
            sample,
            k,
            None,
            criteria,
            3,
            cv2.KMEANS_PP_CENTERS,
        )
    except cv2.error:
        return pixels.mean(axis=0).astype(np.float32)

    labels = labels.reshape(-1)
    counts = np.bincount(labels, minlength=k).astype(np.float32)

    hsv_centers = cv2.cvtColor(centers.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2HSV).reshape(-1, 3)

    best_idx = 0
    best_score = -1.0
    for idx in range(k):
        size_ratio = counts[idx] / max(1.0, counts.sum())
        sat = float(hsv_centers[idx, 1]) / 255.0
        val = float(hsv_centers[idx, 2]) / 255.0

        # 군집 크기를 가장 중시하고, 채도/밝기를 약하게 가산
        score = (size_ratio * 0.75) + (sat * 0.15) + (val * 0.10)
        if score > best_score:
            best_score = score
            best_idx = idx

    return centers[best_idx].astype(np.float32)


def infer_dominant_color(image_bgr: np.ndarray, mask: np.ndarray | None = None) -> str:
    if image_bgr.size == 0:
        return "black"

    pixels = _robust_pixels(image_bgr, mask)
    if pixels.size == 0:
        return "black"

    hsv_pixels = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2HSV).reshape(-1, 3)
    lab_pixels = cv2.cvtColor(pixels.reshape(-1, 1, 3), cv2.COLOR_BGR2LAB).reshape(-1, 3)

    h = hsv_pixels[:, 0].astype(np.float32)
    s = hsv_pixels[:, 1].astype(np.float32)
    v = hsv_pixels[:, 2].astype(np.float32)

    l = lab_pixels[:, 0].astype(np.float32)
    a = lab_pixels[:, 1].astype(np.float32)
    b = lab_pixels[:, 2].astype(np.float32)

    # 극단적인 그림자/하이라이트 제거
    valid_mask = (v >= 20) & (v <= 245)
    if valid_mask.sum() >= max(20, int(len(v) * 0.2)):
        pixels = pixels[valid_mask]
        h = h[valid_mask]
        s = s[valid_mask]
        v = v[valid_mask]
        l = l[valid_mask]
        a = a[valid_mask]
        b = b[valid_mask]

    if len(v) == 0:
        return "black"

    median_v = float(np.median(v))
    mean_b = float(np.mean(b))
    very_low_sat_ratio = float(np.mean(s < 28)) if len(s) > 0 else 0.0
    low_sat_ratio = float(np.mean(s < 45)) if len(s) > 0 else 0.0

    if median_v < 38:
        return "black"

    # neutral 계열은 충분히 확실할 때만 우선 판정
    if very_low_sat_ratio >= 0.72 or low_sat_ratio >= 0.82:
        if median_v >= 232:
            return "white"
        if median_v >= 212:
            if mean_b >= 142:
                return "cream"
            if mean_b >= 135:
                return "ivory"
            return "white"
        if median_v >= 178:
            if mean_b >= 145:
                return "beige"
            if mean_b >= 136:
                return "ivory"
            return "gray"
        if mean_b >= 145 and median_v >= 115:
            return "beige"
        if mean_b >= 138 and median_v >= 90:
            return "brown"
        return "gray"

    # 저채도 warm neutral 보정
    low_sat_warm_ratio = float(np.mean((s < 70) & (v >= 145) & (b >= 138)))
    if low_sat_warm_ratio >= 0.58:
        if mean_b >= 145 and median_v >= 165:
            return "beige"
        if mean_b >= 132 and median_v >= 130:
            return "khaki"
        return "brown"

    chroma_mask = s >= 35
    if chroma_mask.sum() < max(10, int(len(s) * 0.15)):
        rep_bgr = _choose_representative_cluster(pixels)
        rep_rgb = np.array([[[rep_bgr[2], rep_bgr[1], rep_bgr[0]]]], dtype=np.uint8)
        rep_lab = cv2.cvtColor(rep_rgb, cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)
        return _lab_distance_to_palette(
            rep_lab,
            ["black", "white", "gray", "ivory", "cream", "beige", "brown"],
        )

    h_chroma = h[chroma_mask]
    s_chroma = s[chroma_mask]
    v_chroma = v[chroma_mask]

    bins = {
        "red": ((h_chroma < 10) | (h_chroma >= 170)),
        "orange": ((h_chroma >= 10) & (h_chroma < 22)),
        "yellow": ((h_chroma >= 22) & (h_chroma < 35)),
        "green": ((h_chroma >= 35) & (h_chroma < 85)),
        "blue": ((h_chroma >= 85) & (h_chroma < 130)),
        "purple": ((h_chroma >= 130) & (h_chroma < 170)),
    }

    scores: dict[str, float] = {}
    total = float(len(h_chroma))

    for name, bin_mask in bins.items():
        if not np.any(bin_mask):
            scores[name] = 0.0
            continue

        ratio = float(np.sum(bin_mask)) / total
        sat_weight = float(np.mean(s_chroma[bin_mask])) / 255.0
        val_weight = float(np.mean(v_chroma[bin_mask])) / 255.0
        scores[name] = ratio * (0.65 + 0.25 * sat_weight + 0.10 * val_weight)

    dominant = max(scores.items(), key=lambda item: item[1])[0]

    # warm 계열이 과하게 튀는 것 보정
    if dominant in {"orange", "yellow"}:
        warm_low_sat_ratio = float(np.mean((h >= 10) & (h < 35) & (s < 75)))
        if warm_low_sat_ratio >= 0.5:
            if median_v >= 180:
                return "beige"
            if mean_b >= 132:
                return "khaki"
            return "brown"

    if dominant == "green":
        muted_green_ratio = float(np.mean((h >= 35) & (h < 80) & (s < 95)))
        if muted_green_ratio >= 0.45:
            return "khaki"

    # blue / navy 분리
    if dominant == "blue":
        dark_blue_ratio = float(np.mean(((h >= 85) & (h < 130)) & (v < 120)))
        if dark_blue_ratio >= 0.45:
            return "navy"

    rep_bgr = _choose_representative_cluster(pixels)
    rep_rgb = np.array([[[rep_bgr[2], rep_bgr[1], rep_bgr[0]]]], dtype=np.uint8)
    rep_lab = cv2.cvtColor(rep_rgb, cv2.COLOR_RGB2LAB)[0, 0].astype(np.float32)

    candidate_groups = {
        "red": ["red", "pink", "brown"],
        "orange": ["orange", "brown", "beige", "khaki"],
        "yellow": ["yellow", "cream", "beige", "khaki"],
        "green": ["green", "khaki"],
        "blue": ["blue", "navy"],
        "purple": ["purple", "pink"],
    }

    candidates = candidate_groups.get(dominant, list(COLOR_PALETTE.keys()))
    return _lab_distance_to_palette(rep_lab, candidates)