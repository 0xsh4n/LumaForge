"""Tiled Real-ESRGAN ONNX inference with cancellation and bounded tile memory."""
from __future__ import annotations

import cv2
import numpy as np

from .. import models_registry as reg
from .inference import onnx_session


def upscale(img: np.ndarray, scale: int, job=None, tile: int = 128, margin: int = 10) -> tuple[np.ndarray, str]:
    if scale not in (2, 4):
        raise ValueError("Scale must be 2 or 4.")
    spec = reg.get("realesrgan_x4plus")
    if spec is None or not reg.is_installed(spec):
        raise RuntimeError("Real-ESRGAN x4plus is not installed. Install it in Settings → AI models.")
    session, provider = onnx_session(reg.model_path(spec))
    h, w = img.shape[:2]
    out = np.zeros((h * 4, w * 4, 3), np.float32)
    count = ((h + tile - 1) // tile) * ((w + tile - 1) // tile)
    done = 0
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            if job is not None and job.cancel_requested:
                return np.empty((0, 0, 3), np.float32), provider
            y0, x0 = max(0, y - margin), max(0, x - margin)
            y1, x1 = min(h, y + tile + margin), min(w, x + tile + margin)
            patch = np.clip(img[y0:y1, x0:x1], 0, 1).transpose(2, 0, 1)[None].astype(np.float32)
            raw = session.run(None, {session.get_inputs()[0].name: patch})[0][0]
            pred = np.clip(raw.transpose(1, 2, 0), 0, 1)
            cy0, cx0 = (y - y0) * 4, (x - x0) * 4
            cy1 = cy0 + min(tile, h - y) * 4
            cx1 = cx0 + min(tile, w - x) * 4
            out[y * 4:y * 4 + cy1 - cy0, x * 4:x * 4 + cx1 - cx0] = pred[cy0:cy1, cx0:cx1]
            done += 1
            if job is not None:
                job.provider = provider
                job.progress = done / count
                job.message = f"Upscaling tiles ({done}/{count})"
    if scale == 2:
        out = cv2.resize(out, (w * 2, h * 2), interpolation=cv2.INTER_AREA)
    return out.astype(np.float32), provider
