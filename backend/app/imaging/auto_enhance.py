"""Auto Enhance — adaptive, per-image enhancement profiles.

The core idea that keeps this honest and non-destructive: Auto Enhance never
touches pixels directly. It *analyzes* the photograph and returns a set of
:class:`~app.schemas.Adjustments` — the very same parameters the manual sliders
produce — which the normal pipeline then renders. Every value it chooses lands
in the editor and stays fully editable.

The chosen values are derived from image statistics (percentiles, colour
balance, contrast, estimated noise), so two different photos get two different
profiles — there are no fixed "filter" numbers. A `strength` control blends the
computed profile with neutral, and three `mode`s restyle the intent.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

from ..schemas import Adjustments
from .adjustments import _gaussian  # reuse the shared blur helper
from .color import luminance

Mode = str  # "natural" | "professional" | "cinematic"


@dataclass
class SceneStats:
    mean_luma: float
    median_luma: float
    p_lo: float      # 0.4th percentile (black point)
    p_hi: float      # 99.6th percentile (white point)
    black_clip: float
    white_clip: float
    contrast: float  # std of luminance
    sat_mean: float
    temp_bias: float  # >0 warm (R>B), <0 cool
    tint_bias: float  # >0 magenta, <0 green
    noise: float      # estimated luminance noise (0..~1)


def analyze_scene(img: np.ndarray) -> SceneStats:
    """Robust statistics used to drive the enhancement profile."""
    L = luminance(img).astype(np.float32)
    flat = L.reshape(-1)
    p_lo, med, p_hi = np.percentile(flat, [0.4, 50, 99.6])

    mean_rgb = img.reshape(-1, 3).mean(axis=0)
    sat = (img.max(axis=2) - img.min(axis=2)).mean()

    # Noise estimate: high-frequency residual measured where the image is
    # locally flat (so real edges don't inflate it). MAD → robust σ.
    hp = L - _gaussian(L, 1.2)
    gx = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3)
    grad = cv2.magnitude(gx, gy)
    flat_mask = grad < np.percentile(grad, 40)
    resid = hp[flat_mask]
    noise = float(1.4826 * np.median(np.abs(resid - np.median(resid)))) if resid.size else 0.0

    return SceneStats(
        mean_luma=float(flat.mean()),
        median_luma=float(med),
        p_lo=float(p_lo),
        p_hi=float(p_hi),
        black_clip=float(np.mean(flat < 0.02)),
        white_clip=float(np.mean(flat > 0.98)),
        contrast=float(flat.std()),
        sat_mean=float(sat),
        temp_bias=float(mean_rgb[0] - mean_rgb[2]),
        tint_bias=float((mean_rgb[0] + mean_rgb[2]) * 0.5 - mean_rgb[1]),
        noise=noise,
    )


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _base_profile(s: SceneStats) -> Adjustments:
    """The full-strength, mode-neutral enhancement derived from the scene."""
    a = Adjustments()

    # --- Exposure: aim the median toward a pleasant mid-tone, gently. ---
    target_med = 0.46
    if s.median_luma > 1e-3:
        ev = np.log2(target_med / s.median_luma) * 0.6
        if s.white_clip > 0.02:
            ev -= 0.2  # don't push already-blown highlights further
        a.light.exposure = _clamp(ev, -1.2, 1.2)

    # --- White / black points. ---
    if s.p_hi < 0.93:
        a.light.whites = _clamp((0.96 - s.p_hi) * 180.0, 0, 35)
    elif s.white_clip > 0.03:
        a.light.whites = -_clamp((s.white_clip - 0.03) * 300.0, 0, 20)

    if s.p_lo > 0.06:  # raised / hazy blacks → deepen
        a.light.blacks = -_clamp((s.p_lo - 0.03) * 220.0, 0, 28)
    elif s.black_clip > 0.04:  # crushed → lift a touch
        a.light.blacks = _clamp((s.black_clip - 0.04) * 180.0, 0, 18)

    # --- Highlight recovery / shadow lift. ---
    if s.white_clip > 0.01 or s.p_hi > 0.97:
        a.light.highlights = -_clamp(s.white_clip * 500.0 + 10, 0, 45)
    if s.black_clip > 0.02 or s.p_lo < 0.04:
        a.light.shadows = _clamp(s.black_clip * 400.0 + 12, 0, 42)

    # --- Contrast toward a target spread. ---
    target_contrast = 0.22
    if s.contrast < target_contrast:
        a.light.contrast = _clamp((target_contrast - s.contrast) * 180.0, 0, 28)
    elif s.contrast > 0.30:
        a.light.contrast = -_clamp((s.contrast - 0.30) * 120.0, 0, 12)

    # --- White balance: partially neutralise a cast (keep some character). ---
    a.color.temperature = _clamp(-s.temp_bias * 160.0, -30, 30)
    a.color.tint = _clamp(-s.tint_bias * 140.0, -20, 20)

    # --- Vibrance: lift muted images, protect already-saturated ones. ---
    if s.sat_mean < 0.16:
        a.color.vibrance = _clamp((0.16 - s.sat_mean) * 170.0, 0, 26)

    # --- Dehaze when the image reads flat + raised-black + desaturated. ---
    if s.contrast < 0.17 and s.p_lo > 0.07 and s.sat_mean < 0.16:
        a.detail.dehaze = _clamp((0.17 - s.contrast) * 120.0, 0, 18)

    # --- Noise reduction + adaptive sharpening (don't amplify noise). ---
    a.detail.noise_reduction = _clamp(s.noise * 1200.0, 0, 45)
    noisy = a.detail.noise_reduction > 20
    a.detail.sharpen_amount = 22.0 if noisy else 34.0
    a.detail.sharpen_masking = 60.0 if noisy else 45.0
    a.detail.clarity = 6.0

    return a


def _restyle(a: Adjustments, mode: Mode) -> Adjustments:
    """Apply a mode's creative intent on top of the neutral base profile."""
    if mode == "professional":
        a.light.contrast *= 1.15
        a.detail.clarity += 8
        a.detail.texture += 6
        a.color.temperature += 3
        a.color.vibrance += 4
        a.effects.vignette += 8
        a.detail.sharpen_amount = min(60, a.detail.sharpen_amount + 6)
    elif mode == "cinematic":
        a.light.contrast *= 1.2
        a.light.highlights -= 10
        a.light.shadows += 8
        a.light.blacks -= 6
        a.color.temperature -= 8   # cooler overall
        a.color.tint += 2
        a.color.saturation -= 8
        a.color.vibrance *= 0.8
        a.detail.clarity += 8
        a.detail.dehaze += 6
        a.effects.vignette += 24
    else:  # natural
        a.light.contrast *= 0.85
        a.color.vibrance *= 0.9
        a.light.highlights *= 1.1  # a touch more highlight protection
    return a


def _lerp_from_neutral(a: Adjustments, t: float) -> Adjustments:
    """Blend the profile with neutral by factor t∈[0,1] (the strength slider)."""
    neutral = Adjustments()
    out = Adjustments()
    for group in ("light", "color", "detail", "effects"):
        g_a = getattr(a, group)
        g_n = getattr(neutral, group)
        g_o = getattr(out, group)
        for field in type(g_a).model_fields:
            va = getattr(g_a, field)
            vn = getattr(g_n, field)
            setattr(g_o, field, vn + (va - vn) * t)
    return out


def _describe(s: SceneStats, a: Adjustments) -> list[str]:
    notes: list[str] = []
    if a.light.exposure > 0.08:
        notes.append("Brightened an underexposed image")
    elif a.light.exposure < -0.08:
        notes.append("Reduced exposure on a bright image")
    if a.light.highlights < -5:
        notes.append("Recovered blown highlights")
    if a.light.shadows > 5:
        notes.append("Opened up the shadows")
    if abs(a.color.temperature) > 5 or abs(a.color.tint) > 5:
        notes.append("Corrected a " + ("warm" if s.temp_bias > 0 else "cool") + " colour cast")
    if a.light.contrast > 5:
        notes.append("Added contrast to a flat image")
    if a.color.vibrance > 5:
        notes.append("Lifted vibrance on muted colours")
    if a.detail.dehaze > 3:
        notes.append("Cut atmospheric haze")
    if a.detail.noise_reduction > 20:
        notes.append("Applied noise reduction, kept sharpening gentle")
    if not notes:
        notes.append("Image is already well balanced — only subtle refinements applied")
    return notes


def auto_enhance(img: np.ndarray, mode: Mode = "natural", strength: float = 100.0) -> dict:
    """Return an editable enhancement profile + a human-readable summary."""
    s = analyze_scene(img)
    base = _restyle(_base_profile(s), mode)
    final = _lerp_from_neutral(base, _clamp(strength / 100.0, 0.0, 1.0))
    # Round to the slider granularity so the UI shows clean values.
    for group in ("light", "color", "detail", "effects"):
        g = getattr(final, group)
        for field in type(g).model_fields:
            val = getattr(g, field)
            setattr(g, field, round(val, 2))
    return {
        "adjustments": final,
        "mode": mode,
        "strength": strength,
        "notes": _describe(s, base),
        "scene": {
            "mean_luma": round(s.mean_luma, 3),
            "contrast": round(s.contrast, 3),
            "cast": "warm" if s.temp_bias > 0.01 else "cool" if s.temp_bias < -0.01 else "neutral",
            "noisy": bool(s.noise * 1200.0 > 20),
        },
    }
