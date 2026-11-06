"""Motion & lens effects (Phase 5) — classical, model-free motion blur.

Three creative blurs, all pure OpenCV and resolution-independent (their extents
are fractions of the image size, so a preview matches the full-size export):

* ``linear`` — directional blur via a line convolution kernel at ``angle``.
* ``zoom``   — radial "dolly" streak, averaging frames scaled about a center.
* ``spin``   — rotational streak, averaging frames rotated about a center.

Selective motion (background vs. subject) is done by masking a ``blur``
LocalAdjust in the masking engine; this module is the whole-frame look. AI-guided
motion is an optional later addition.
"""
from __future__ import annotations

import cv2
import numpy as np

from ..schemas import MotionAdjust

# Number of samples averaged for zoom/spin. 12 is smooth without being costly.
_SAMPLES = 12


def _line_kernel(length: int, angle: float) -> np.ndarray:
    """A normalized line point-spread function of ``length`` px at ``angle``."""
    if length % 2 == 0:
        length += 1
    kernel = np.zeros((length, length), np.float32)
    c = length // 2
    th = np.deg2rad(angle)
    half = length / 2.0
    x0 = int(round(c - half * np.cos(th)))
    y0 = int(round(c - half * np.sin(th)))
    x1 = int(round(c + half * np.cos(th)))
    y1 = int(round(c + half * np.sin(th)))
    cv2.line(kernel, (x0, y0), (x1, y1), 1.0, thickness=1, lineType=cv2.LINE_AA)
    s = float(kernel.sum())
    if s <= 0:
        kernel[c, c] = 1.0
        return kernel
    return kernel / s


def _directional(img: np.ndarray, length: int, angle: float) -> np.ndarray:
    if length < 2:
        return img
    k = _line_kernel(length, angle)
    return cv2.filter2D(img, -1, k, borderType=cv2.BORDER_REFLECT)


def _zoom(img: np.ndarray, a: float, cx: float, cy: float) -> np.ndarray:
    h, w = img.shape[:2]
    center = (cx * (w - 1), cy * (h - 1))
    max_scale = 1.0 + a * 0.18  # up to +18% zoom spread
    acc = np.zeros_like(img, dtype=np.float32)
    for i in range(_SAMPLES):
        s = 1.0 + (max_scale - 1.0) * (i / (_SAMPLES - 1))
        m = cv2.getRotationMatrix2D(center, 0.0, s)
        acc += cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_REFLECT)
    return acc / _SAMPLES


def _spin(img: np.ndarray, a: float, cx: float, cy: float) -> np.ndarray:
    h, w = img.shape[:2]
    center = (cx * (w - 1), cy * (h - 1))
    max_arc = a * 12.0  # up to ±6° about the center
    acc = np.zeros_like(img, dtype=np.float32)
    for i in range(_SAMPLES):
        ang = -max_arc / 2.0 + max_arc * (i / (_SAMPLES - 1))
        m = cv2.getRotationMatrix2D(center, ang, 1.0)
        acc += cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_LINEAR,
                              borderMode=cv2.BORDER_REFLECT)
    return acc / _SAMPLES


def apply_motion(img: np.ndarray, m: MotionAdjust, px_scale: float = 1.0) -> np.ndarray:
    """Apply the selected whole-frame motion blur. Neutral (``none``/0) is a no-op."""
    if m.type == "none" or m.amount <= 0:
        return img
    a = m.amount / 100.0
    h, w = img.shape[:2]
    long_edge = max(h, w)
    if m.type == "linear":
        length = int(round(a * 0.08 * long_edge))  # up to ~8% of the long edge
        out = _directional(img, length, m.angle)
    elif m.type == "zoom":
        out = _zoom(img, a, m.cx, m.cy)
    elif m.type == "spin":
        out = _spin(img, a, m.cx, m.cy)
    else:
        return img
    return np.clip(out, 0.0, 1.0)
