"""Lazy ONNX runtime and bounded session cache for optional inference models."""
from __future__ import annotations

from collections import OrderedDict
from pathlib import Path
import threading
from typing import Callable

import numpy as np

_sessions: OrderedDict[tuple[str, bool], tuple[object, str]] = OrderedDict()
_lock = threading.RLock()
_MAX_SESSIONS = 2


def onnx_session(model_path: str | Path, prefer_gpu: bool = True):
    """Load an ONNX model on CUDA when available, otherwise explicitly on CPU."""
    try:
        import onnxruntime as ort
    except ImportError as exc:
        raise RuntimeError("Install the optional AI extras (onnxruntime) to use this feature.") from exc
    path = str(Path(model_path).resolve())
    key = (path, bool(prefer_gpu))
    with _lock:
        if key in _sessions:
            _sessions.move_to_end(key)
            return _sessions[key]
        available = set(ort.get_available_providers())
        providers = (["CUDAExecutionProvider"] if prefer_gpu and "CUDAExecutionProvider" in available else [])
        providers.append("CPUExecutionProvider")
        try:
            session = ort.InferenceSession(path, providers=providers)
        except Exception as exc:
            raise RuntimeError(f"Could not load AI model: {exc}") from exc
        active = session.get_providers()
        provider = "CUDAExecutionProvider" if active and active[0] == "CUDAExecutionProvider" else "CPUExecutionProvider"
        _sessions[key] = (session, provider)
        while len(_sessions) > _MAX_SESSIONS:
            _sessions.popitem(last=False)
        return session, provider


def unload_all() -> None:
    with _lock:
        _sessions.clear()


def tiled_infer(session, img: np.ndarray, tile: int, overlap: int,
                run_fn: Callable[[object, np.ndarray], np.ndarray]) -> np.ndarray:
    """Infer overlapping HWC tiles and feather blend the results into an HWC map."""
    if tile <= 0 or overlap < 0 or overlap >= tile:
        raise ValueError("tile must be positive and overlap must be in [0, tile)")
    h, w = img.shape[:2]
    stride = tile - overlap
    out = weights = None
    for y in range(0, h, stride):
        for x in range(0, w, stride):
            y1, x1 = min(y + tile, h), min(x + tile, w)
            patch = np.asarray(run_fn(session, img[y:y1, x:x1]))
            if patch.shape[:2] != (y1 - y, x1 - x):
                raise ValueError("tiled inference output must match tile dimensions")
            if out is None:
                out = np.zeros((h, w, *patch.shape[2:]), np.float32)
                weights = np.zeros((h, w), np.float32)
            th, tw = patch.shape[:2]
            wy = np.ones(th, np.float32); wx = np.ones(tw, np.float32)
            band = min(overlap, th // 2, tw // 2)
            if band:
                ramp = np.linspace(0, 1, band, dtype=np.float32)
                if y > 0: wy[:band] = ramp
                if y1 < h: wy[-band:] = ramp[::-1]
                if x > 0: wx[:band] = ramp
                if x1 < w: wx[-band:] = ramp[::-1]
            weight = wy[:, None] * wx[None, :]
            out[y:y1, x:x1] += patch.astype(np.float32) * weight[(...,) + (None,) * (patch.ndim - 2)]
            weights[y:y1, x:x1] += weight
    if out is None:
        return np.empty_like(img, dtype=np.float32)
    return out / np.maximum(weights, 1e-8)[(...,) + (None,) * (out.ndim - 2)]
