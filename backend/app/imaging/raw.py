"""RAW / DNG development via LibRaw (rawpy).

A proper RAW pipeline — decode sensor data, demosaic, white balance, camera
colour, exposure and highlight handling at 16-bit — not embedded-JPEG
extraction. The developed image becomes the session's working original; fine
tonal/colour work is then done with the normal adjustment sliders on top, so
RAW edits remain fully non-destructive (the RAW file is never modified).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..schemas import RawParams
from .color import to_float

try:
    import rawpy  # type: ignore

    RAW_AVAILABLE = True
except Exception:  # pragma: no cover
    RAW_AVAILABLE = False


class RawError(Exception):
    pass


def _demosaic(params: RawParams):
    return getattr(rawpy.DemosaicAlgorithm, params.demosaic, rawpy.DemosaicAlgorithm.AHD)


def develop_raw(path: str | Path, params: RawParams | None = None) -> tuple[np.ndarray, dict]:
    """Develop a RAW file to float32 RGB [0,1] + metadata."""
    if not RAW_AVAILABLE:
        raise RawError("RAW support is not installed (pip install rawpy).")
    params = params or RawParams()
    p = Path(path)

    kwargs: dict = dict(
        output_bps=16,
        no_auto_bright=True,
        output_color=rawpy.ColorSpace.sRGB,
        gamma=(2.222, 4.5),  # sRGB-ish tone
        demosaic_algorithm=_demosaic(params),
        highlight_mode=int(params.highlight_mode),
        fbdd_noise_reduction=rawpy.FBDDNoiseReductionMode(params.noise_reduction),
    )
    if params.wb_mode == "camera":
        kwargs["use_camera_wb"] = True
    elif params.wb_mode == "auto":
        kwargs["use_auto_wb"] = True
    # "daylight" → leave both off (LibRaw uses the daylight/embedded matrix)
    if params.exposure != 0:
        kwargs["exp_shift"] = float(2.0 ** params.exposure)
        kwargs["exp_preserve_highlights"] = 1.0

    try:
        with rawpy.imread(str(p)) as raw:
            wb = [round(float(x), 1) for x in raw.camera_whitebalance]
            color_desc = raw.color_desc.decode("ascii", "ignore") if raw.color_desc else ""
            rgb16 = raw.postprocess(**kwargs)
    except Exception as e:
        raise RawError(f"Failed to develop RAW: {e}")

    img = to_float(rgb16.astype(np.uint16))
    h, w = img.shape[:2]
    meta = {
        "filename": p.name,
        "source_path": str(p),
        "format": "RAW",
        "bit_depth": 16,
        "channels": 3,
        "width": w,
        "height": h,
        "megapixels": round(w * h / 1e6, 2),
        "is_raw": True,
        "exif": {"camera_whitebalance": str(wb), "cfa": color_desc},
    }
    return np.ascontiguousarray(img), meta
