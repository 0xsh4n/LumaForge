"""Depth Anything inference and deterministic depth-aware background defocus."""
from __future__ import annotations

import threading
import cv2
import numpy as np

from .. import models_registry as reg
from ..schemas import DepthAdjust
from .inference import onnx_session

_cache: dict[tuple[str, tuple[int, int]], tuple[np.ndarray, str]] = {}
_lock = threading.RLock()


def depth_map(image_id: str, img: np.ndarray, model_id: str = "depth_anything_v2_small") -> tuple[np.ndarray, str]:
    key = (image_id, img.shape[:2])
    with _lock:
        if key in _cache:
            return _cache[key][0].copy(), _cache[key][1]
    spec = reg.get(model_id)
    if spec is None or not reg.is_installed(spec):
        raise RuntimeError("Depth model is not installed. Install Depth Anything V2 in Settings → AI models.")
    session, provider = onnx_session(reg.model_path(spec))
    input_meta = session.get_inputs()[0]
    h, w = img.shape[:2]
    scale = min(1.0, 518.0 / min(h, w))
    ih = max(14, int(round(h * scale / 14) * 14))
    iw = max(14, int(round(w * scale / 14) * 14))
    rgb = cv2.resize(np.clip(img, 0, 1), (iw, ih), interpolation=cv2.INTER_AREA)
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)
    tensor = ((rgb - mean) / std).transpose(2, 0, 1)[None].astype(np.float32)
    outputs = session.run(None, {input_meta.name: tensor})
    raw = np.asarray(outputs[0], np.float32).squeeze()
    if raw.ndim != 2:
        raise RuntimeError("Depth model returned an unsupported map shape.")
    lo, hi = np.percentile(raw, [2, 98])
    normalized = np.clip((raw - lo) / max(float(hi - lo), 1e-6), 0, 1)
    # Depth Anything emits relative inverse depth: high values are nearer.
    result = cv2.resize(normalized, (w, h), interpolation=cv2.INTER_CUBIC)
    result = cv2.bilateralFilter(np.clip(result, 0, 1).astype(np.float32), 7, 0.08, 5)
    with _lock:
        _cache[key] = (result.copy(), provider)
    return result, provider


def clear_cache(image_id: str | None = None):
    with _lock:
        if image_id is None:
            _cache.clear()
        else:
            for key in [k for k in _cache if k[0] == image_id]:
                del _cache[key]


def is_cached(image_id: str, shape: tuple[int, int]) -> bool:
    with _lock:
        return (image_id, shape) in _cache


def apply_bokeh(img: np.ndarray, depth: np.ndarray, params: DepthAdjust,
                px_scale: float = 1.0, subject: np.ndarray | None = None) -> np.ndarray:
    if not params.enabled or depth is None:
        return img
    h, w = img.shape[:2]
    d = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)
    transition = max(0.025, params.transition / 100.0 * 0.5)
    distance = np.maximum(np.abs(d - params.focus) - transition * 0.5, 0)
    strength = np.clip(distance / max(1 - transition * 0.5, 0.05), 0, 1)
    # f/1.4 gives the strongest blur; image-relative radius keeps preview/export consistent.
    aperture_strength = (8.0 / params.aperture - 1.0) / (8.0 / 1.4 - 1.0)
    radius = max(h, w) * 0.035 * aperture_strength
    if radius < 0.25:
        return img
    out = np.asarray(img, np.float32)
    for fraction in (0.25, 0.5, 1.0):
        sigma = max(0.3, radius * fraction)
        if params.bokeh_shape == "hex":
            r = max(2, min(18, int(round(sigma))))
            yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
            kernel = ((np.abs(yy) <= r * 0.87) & (np.abs(xx) + np.abs(yy) / np.sqrt(3) <= r)).astype(np.float32)
            kernel /= max(float(kernel.sum()), 1.0)
            blurred = cv2.filter2D(img, -1, kernel, borderType=cv2.BORDER_REFLECT)
        else:
            blurred = cv2.GaussianBlur(img, (0, 0), sigma, borderType=cv2.BORDER_REFLECT)
        weight = np.clip((strength - (fraction - 0.25)) / 0.75, 0, 1)[..., None]
        out = out * (1 - weight) + blurred * weight
    if subject is not None:
        matte = cv2.resize(subject, (w, h), interpolation=cv2.INTER_LINEAR)
        protect = matte * (params.subject_protect / 100.0)
        out = out * (1 - protect[..., None]) + img * protect[..., None]
    if params.highlight_bloom > 0:
        highlights = np.clip((img.max(axis=2) - 0.78) / 0.22, 0, 1) * (params.highlight_bloom / 100.0)
        glow = cv2.GaussianBlur(img * highlights[..., None], (0, 0), max(1.0, radius * 0.35))
        out = np.clip(out + glow * 0.22, 0, 1)
    return np.clip(out, 0, 1).astype(np.float32)
