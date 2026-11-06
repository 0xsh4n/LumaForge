"""Masking engine (Phase 4) — classical, model-free masks + local adjustments.

A :class:`~app.schemas.Mask` describes a selection as *parameters* (a gradient
direction, an ellipse, or painted dabs), never as baked pixels, so it rebuilds
crisply at any render resolution — the same non-destructive contract as the rest
of the pipeline. Each mask carries a :class:`~app.schemas.LocalAdjust`; we render
those adjustments over the whole frame and composite the result through the mask.

Everything here is pure NumPy/OpenCV. AI subject/sky masks (BiRefNet/SAM) and a
depth-driven bokeh will slot in later as additional mask sources feeding the same
``apply_masks`` compositor.
"""
from __future__ import annotations

import cv2
import numpy as np

from ..schemas import LocalAdjust, Mask
from . import adjustments as adj

EPS = 1e-6


# ---------------------------------------------------------------------------
# Mask geometry → a float32 [0,1] weight map at the render resolution
# ---------------------------------------------------------------------------


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0 + EPS), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _linear(mask: Mask, h: int, w: int) -> np.ndarray:
    """Linear gradient: 1 on the ``start`` side, 0 past ``end``, along ``angle``."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = xx / max(w - 1, 1)
    v = yy / max(h - 1, 1)
    th = np.deg2rad(mask.angle)
    p = u * np.cos(th) + v * np.sin(th)
    # Normalize the projection to [0,1] across the image for this direction.
    corners = [
        0.0,
        np.cos(th),
        np.sin(th),
        np.cos(th) + np.sin(th),
    ]
    pmin, pmax = float(min(corners)), float(max(corners))
    p = (p - pmin) / (pmax - pmin + EPS)
    denom = mask.end - mask.start
    if abs(denom) < EPS:
        denom = EPS if denom >= 0 else -EPS
    frac = np.clip((p - mask.start) / denom, 0.0, 1.0)
    return 1.0 - (frac * frac * (3.0 - 2.0 * frac))  # smooth 1 → 0


def _radial(mask: Mask, h: int, w: int) -> np.ndarray:
    """Elliptical gradient: 1 inside, fading to 0 at the boundary (feather band)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx = mask.cx * (w - 1)
    cy = mask.cy * (h - 1)
    rx = max(mask.rx, 1e-3) * w
    ry = max(mask.ry, 1e-3) * h
    nx = (xx - cx) / rx
    ny = (yy - cy) / ry
    d = np.sqrt(nx * nx + ny * ny)  # == 1.0 on the ellipse boundary
    soft = 0.15 + 0.85 * (mask.feather / 100.0)
    return 1.0 - _smoothstep(1.0 - soft, 1.0, d)


def _brush(mask: Mask, h: int, w: int) -> np.ndarray:
    """Union of painted dabs (erase dabs subtract). Each dab is computed on its
    own bounding box, so cost scales with painted area, not dab count × pixels."""
    m = np.zeros((h, w), np.float32)
    long_edge = max(h, w)
    for dab in mask.dabs:
        cx = dab.x * (w - 1)
        cy = dab.y * (h - 1)
        rad = max(dab.radius * long_edge, 1.0)
        x0, x1 = max(0, int(cx - rad)), min(w, int(cx + rad) + 1)
        y0, y1 = max(0, int(cy - rad)), min(h, int(cy + rad) + 1)
        if x0 >= x1 or y0 >= y1:
            continue
        ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32)
        dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / rad
        dab_m = 1.0 - _smoothstep(dab.hardness, 1.0, dist)
        roi = m[y0:y1, x0:x1]
        if dab.erase:
            m[y0:y1, x0:x1] = np.clip(roi - dab_m, 0.0, 1.0)
        else:
            m[y0:y1, x0:x1] = np.maximum(roi, dab_m)
    return m


def build_mask(mask: Mask, h: int, w: int) -> np.ndarray:
    """Build the float32 [0,1] weight map for ``mask`` at ``h×w``."""
    if mask.type == "linear":
        m = _linear(mask, h, w)
    elif mask.type == "radial":
        m = _radial(mask, h, w)
    else:
        m = _brush(mask, h, w)

    if mask.invert:
        m = 1.0 - m

    # An extra feather pass softens radial/brush edges (linear is already smooth).
    if mask.type != "linear":
        fpx = (mask.feather / 100.0) * 0.03 * max(h, w)
        if fpx >= 0.5:
            m = cv2.GaussianBlur(m, (0, 0), fpx, borderType=cv2.BORDER_REFLECT)

    m = np.clip(m, 0.0, 1.0) * (mask.opacity / 100.0)
    return m.astype(np.float32)


# ---------------------------------------------------------------------------
# Local adjustments
# ---------------------------------------------------------------------------


def _local_is_neutral(local: LocalAdjust) -> bool:
    return (
        local.exposure == 0 and local.contrast == 0 and local.highlights == 0
        and local.shadows == 0 and local.whites == 0 and local.blacks == 0
        and local.temperature == 0 and local.tint == 0 and local.saturation == 0
        and local.vibrance == 0 and local.clarity == 0 and local.sharpness == 0
        and local.blur == 0
    )


def apply_local(img: np.ndarray, local: LocalAdjust, px_scale: float = 1.0) -> np.ndarray:
    """Render a LocalAdjust over the whole image (composited through a mask later)."""
    out = adj.apply_wb_exposure(img, local.temperature, local.tint, local.exposure)
    out = adj.apply_tone(
        out, local.contrast, local.highlights, local.shadows, local.whites, local.blacks
    )
    if local.clarity != 0:
        out = adj.apply_local_contrast(out, 0.0, local.clarity, 0.0)
    if local.saturation != 0 or local.vibrance != 0:
        out = adj.apply_color(out, local.vibrance, local.saturation, 0.0)
    if local.sharpness > 0:
        out = adj.apply_sharpen(out, local.sharpness, 1.0, 25.0, 0.0, px_scale)
    if local.blur > 0:
        # Sigma as a fraction of the image dims → visually consistent preview↔export.
        sigma = (local.blur / 100.0) ** 1.3 * 0.045 * max(img.shape[:2])
        if sigma >= 0.3:
            out = cv2.GaussianBlur(out, (0, 0), sigma, borderType=cv2.BORDER_REFLECT)
    return np.clip(out, 0.0, 1.0)


def apply_masks(img: np.ndarray, masks: list[Mask], px_scale: float = 1.0) -> np.ndarray:
    """Composite each enabled mask's local adjustments onto ``img``, in order."""
    if not masks:
        return img
    out = img
    h, w = img.shape[:2]
    for mask in masks:
        if not mask.enabled or _local_is_neutral(mask.local):
            continue
        m = build_mask(mask, h, w)
        if float(m.max()) <= 0.0:
            continue
        local = apply_local(out, mask.local, px_scale)
        mm = m[..., None]
        out = out * (1.0 - mm) + local * mm
    return np.clip(out, 0.0, 1.0)
