"""The non-destructive render pipeline.

``render`` turns an untouched original plus an :class:`Adjustments` description
into a new image. It is pure: it never mutates the input array, so previews and
exports can run concurrently off the same original. Preview and export differ
only in the resolution of the array passed in and the ``px_scale`` that keeps
spatially-defined effects (sharpen radius, noise reduction) consistent between
the two.
"""
from __future__ import annotations

import numpy as np

from ..schemas import Adjustments
from ..lut_store import lut_store
from . import adjustments as adj
from . import grading
from . import portrait as portrait_mod
from .color import luminance


def _lut_resolver(lut_id: str):
    return lut_store.get(lut_id)


def render(original: np.ndarray, a: Adjustments, px_scale: float = 1.0,
           faces: list | None = None) -> np.ndarray:
    """Apply the full adjustment stack. ``original`` is float32 RGB [0,1].

    ``px_scale`` = (this render's long edge) / (original's long edge). It is
    <= 1 for previews so that pixel-defined operations match the full-size
    export result. ``faces`` are normalized detections used by the portrait
    stage (built into masks at this resolution).
    """
    img = np.array(original, dtype=np.float32, copy=True)

    # 1+2. White balance + exposure (single linear-light round-trip)
    img = adj.apply_wb_exposure(
        img, a.color.temperature, a.color.tint, a.light.exposure
    )
    # 3. Tone regions
    img = adj.apply_tone(
        img, a.light.contrast, a.light.highlights, a.light.shadows,
        a.light.whites, a.light.blacks,
    )
    # 4. Local contrast
    img = adj.apply_local_contrast(img, a.detail.texture, a.detail.clarity, a.detail.dehaze)
    # 5. Colour
    img = adj.apply_color(img, a.color.vibrance, a.color.saturation, a.color.hue)
    # 5b. Colour grading (curves / HSL / colour balance / split tone / LUT)
    img = grading.apply_grade(img, a.grade, lut_resolver=_lut_resolver)
    # 5c. Portrait retouch (mask-driven, identity-preserving)
    if a.portrait.enabled and faces:
        from . import face as face_mod

        masks = face_mod.build_masks(img, faces)
        img = portrait_mod.apply_portrait(img, a.portrait, masks)
    # 6. Noise reduction (before sharpening)
    img = adj.apply_noise_reduction(img, a.detail.noise_reduction, px_scale)
    # 7. Sharpening
    img = adj.apply_sharpen(
        img, a.detail.sharpen_amount, a.detail.sharpen_radius,
        a.detail.sharpen_detail, a.detail.sharpen_masking, px_scale,
    )
    # 8. Lens corrections + effects
    img = adj.apply_defringe(img, a.effects.defringe, px_scale)
    img = adj.apply_distortion(img, a.effects.distortion)
    img = adj.apply_vignette(img, a.effects.vignette)
    img = adj.apply_grain(img, a.effects.grain)

    return np.clip(img, 0.0, 1.0)


def render_color_only(img: np.ndarray, a: Adjustments) -> np.ndarray:
    """Apply only the per-pixel colour transform (no spatial ops).

    Used to bake the current look into a 3D LUT: white balance + exposure, tone,
    colour and the full grading stack — but not vignette, sharpening, local
    contrast, noise or grain, which are not expressible as a colour LUT.
    """
    out = np.array(img, dtype=np.float32, copy=True)
    out = adj.apply_wb_exposure(out, a.color.temperature, a.color.tint, a.light.exposure)
    out = adj.apply_tone(out, a.light.contrast, a.light.highlights, a.light.shadows,
                         a.light.whites, a.light.blacks)
    out = adj.apply_color(out, a.color.vibrance, a.color.saturation, a.color.hue)
    out = grading.apply_grade(out, a.grade, lut_resolver=_lut_resolver)
    return np.clip(out, 0.0, 1.0)


def analyze(original: np.ndarray, bins: int = 256) -> dict:
    """Compute lightweight statistics the UI shows and Auto Enhance will use.

    Operates on a (possibly downscaled) float32 RGB [0,1] image.
    """
    L = luminance(original)
    flatL = L.reshape(-1)

    hist_r = np.histogram(original[..., 0], bins=bins, range=(0, 1))[0]
    hist_g = np.histogram(original[..., 1], bins=bins, range=(0, 1))[0]
    hist_b = np.histogram(original[..., 2], bins=bins, range=(0, 1))[0]
    hist_l = np.histogram(flatL, bins=bins, range=(0, 1))[0]

    black_clip = float(np.mean(flatL < 0.02) * 100.0)
    white_clip = float(np.mean(flatL > 0.98) * 100.0)

    mean_rgb = original.reshape(-1, 3).mean(axis=0)
    # Warm/cool bias from red-vs-blue balance; green-vs-(r+b)/2 for tint.
    temp_bias = float((mean_rgb[0] - mean_rgb[2]) * 200.0)
    tint_bias = float(((mean_rgb[0] + mean_rgb[2]) / 2.0 - mean_rgb[1]) * 200.0)

    # Sharpness: variance of the Laplacian on a small proxy is robust enough.
    import cv2

    lap = cv2.Laplacian((L * 255).astype(np.float32), cv2.CV_32F)
    sharpness = float(lap.var())

    return {
        "mean_luma": float(flatL.mean()),
        "median_luma": float(np.median(flatL)),
        "black_clip_pct": round(black_clip, 3),
        "white_clip_pct": round(white_clip, 3),
        "contrast_std": float(flatL.std()),
        "estimated_temp_bias": round(temp_bias, 2),
        "estimated_tint_bias": round(tint_bias, 2),
        "sharpness": round(sharpness, 2),
        "histogram": {
            "bins": bins,
            "red": hist_r.astype(int).tolist(),
            "green": hist_g.astype(int).tolist(),
            "blue": hist_b.astype(int).tolist(),
            "luma": hist_l.astype(int).tolist(),
        },
    }
