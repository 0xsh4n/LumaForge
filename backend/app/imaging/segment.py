"""Optional BiRefNet mattes, cached independently of editable mask parameters."""
from __future__ import annotations

import threading
import cv2
import numpy as np

from .. import models_registry as reg
from .inference import onnx_session

_cache: dict[tuple, np.ndarray] = {}
_lock = threading.RLock()


def cached_mask(image_id: str, model_id: str, kind: str, shape: tuple[int, int]):
    with _lock:
        value = _cache.get((image_id, model_id, kind, shape))
        return None if value is None else value.copy()


def clear_cache(image_id: str | None = None):
    with _lock:
        if image_id is None:
            _cache.clear()
        else:
            for key in [k for k in _cache if k[0] == image_id]:
                del _cache[key]


def subject_mask(img: np.ndarray, model_id: str = "birefnet_lite") -> np.ndarray:
    spec = reg.get(model_id)
    if spec is None or model_id not in ("birefnet_lite", "birefnet_general"):
        raise RuntimeError("Choose a supported BiRefNet model.")
    if not reg.is_installed(spec):
        raise RuntimeError(f"{spec.name} is not installed. Install BiRefNet in Settings → AI models.")
    session, _provider = onnx_session(reg.model_path(spec))
    inp = session.get_inputs()[0]
    dims = inp.shape
    ih = int(dims[-2]) if isinstance(dims[-2], int) else 1024
    iw = int(dims[-1]) if isinstance(dims[-1], int) else 1024
    rgb = np.clip(img, 0, 1)
    resized = cv2.resize(rgb, (iw, ih), interpolation=cv2.INTER_AREA)
    tensor = np.transpose(resized, (2, 0, 1))[None].astype(np.float32)
    output = session.run(None, {inp.name: tensor})[0]
    matte = np.asarray(output, dtype=np.float32).squeeze()
    if matte.ndim != 2:
        raise RuntimeError("BiRefNet returned an unsupported matte shape.")
    # Models can emit logits or normalized probabilities.
    if matte.min() < 0 or matte.max() > 1:
        matte = 1.0 / (1.0 + np.exp(-np.clip(matte, -30, 30)))
    matte = cv2.resize(matte, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
    matte = cv2.bilateralFilter(np.clip(matte, 0, 1), 7, 0.08, 3.0)
    return np.clip(matte, 0, 1).astype(np.float32)


def get_mask(image_id: str, img: np.ndarray, model_id: str, kind: str) -> np.ndarray:
    shape = img.shape[:2]
    cached = cached_mask(image_id, model_id, kind, shape)
    if cached is not None:
        return cached
    subject = subject_mask(img, model_id)
    if kind == "background":
        result = 1.0 - subject
    elif kind == "sky":
        h, w = shape
        yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
        upper = np.clip((0.78 - yy) / 0.35, 0, 1)
        # Honest classical prior: retain likely blue/bright upper-frame regions.
        blue = np.clip((img[..., 2] - np.maximum(img[..., 0], img[..., 1]) + 0.2) / 0.5, 0, 1)
        bright = np.clip((img.mean(axis=2) - 0.35) / 0.45, 0, 1)
        result = np.maximum(1 - subject, 0) * upper * np.maximum(blue, bright * 0.45)
    else:
        result = subject
    result = np.clip(result, 0, 1).astype(np.float32)
    with _lock:
        _cache[(image_id, model_id, kind, shape)] = result.copy()
    return result
