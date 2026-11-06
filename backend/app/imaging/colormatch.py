"""AI Color Match (Phase 7 §23) — classical, model-free grading recommendations.

Analyzes a photograph's colour, light and content, then proposes several
*editable* grading looks as recommendation cards. Like Auto Enhance, it never
touches pixels directly: each card is a full :class:`~app.schemas.Adjustments`
the normal pipeline renders, so every value stays adjustable and the Intensity
control simply blends the look toward neutral.

Each look starts from a per-image base correction (exposure toward a pleasant
mid-tone, partial colour-cast neutralisation, gentle white/black points) and then
layers its creative grade (white balance, split toning, vibrance, contrast).
Skin tones are protected: when the frame contains significant skin, saturation
moves and warm pushes are tempered so faces never go orange or garish.

A local vision-language model can later *augment* this (richer scene/mood tags,
extra bespoke looks) — see the Lumetta Assistant work — but Color Match is fully
functional with no model installed.
"""
from __future__ import annotations

import cv2
import numpy as np

from ..schemas import Adjustments, ColorBalance, ColorWheel, Grade, SplitTone
from .auto_enhance import SceneStats, analyze_scene, _clamp
from .color import to_uint8


def _skin_fraction(img: np.ndarray) -> float:
    """Fraction of the frame that reads as skin (YCrCb heuristic)."""
    ycrcb = cv2.cvtColor(to_uint8(img), cv2.COLOR_RGB2YCrCb)
    cr = ycrcb[..., 1].astype(np.float32)
    cb = ycrcb[..., 2].astype(np.float32)
    m = (cr >= 133) & (cr <= 180) & (cb >= 77) & (cb <= 128)
    return float(m.mean())


def _base_correction(s: SceneStats) -> Adjustments:
    """A gentle, look-neutral starting point adapted to the image."""
    a = Adjustments()
    if s.median_luma > 1e-3:
        a.light.exposure = _clamp(float(np.log2(0.46 / s.median_luma)) * 0.5, -1.0, 1.0)
    a.color.temperature = _clamp(-s.temp_bias * 120.0, -22, 22)
    a.color.tint = _clamp(-s.tint_bias * 110.0, -16, 16)
    if s.p_hi < 0.95:
        a.light.whites = _clamp((0.96 - s.p_hi) * 150.0, 0, 22)
    if s.p_lo > 0.06:
        a.light.blacks = -_clamp((s.p_lo - 0.03) * 160.0, 0, 18)
    return a


def _split(shadow_hue: float, shadow_sat: float, hi_hue: float, hi_sat: float,
           balance: float = 0.0) -> SplitTone:
    return SplitTone(shadow_hue=shadow_hue, shadow_sat=shadow_sat,
                     highlight_hue=hi_hue, highlight_sat=hi_sat, balance=balance)


# A "look" is (id, title, description, accent, builder). The builder receives the
# base-corrected Adjustments, the scene stats and a skin-protection factor
# (1.0 = no skin, →0.4 = lots of skin) and returns the final Adjustments.
def _natural(a: Adjustments, s: SceneStats, skin: float) -> Adjustments:
    a.light.contrast += 8
    a.color.vibrance += 10 * skin
    a.detail.clarity += 4
    return a


def _warm_cinematic(a: Adjustments, s: SceneStats, skin: float) -> Adjustments:
    a.color.temperature = _clamp(a.color.temperature + 12, -40, 40)
    a.color.saturation -= 6 * skin
    a.light.contrast += 12
    a.light.highlights -= 6
    a.light.shadows += 6
    a.light.blacks -= 5
    a.effects.vignette += 15
    a.grade = Grade(split_tone=_split(195, 22 * skin, 45, 26 * skin, -10))
    return a


def _cool_editorial(a: Adjustments, s: SceneStats, skin: float) -> Adjustments:
    a.color.temperature = _clamp(a.color.temperature - 12, -40, 40)
    a.color.saturation -= 12 * skin
    a.light.blacks += 10          # lifted, matte blacks
    a.light.shadows += 8
    a.light.contrast += 4
    a.detail.clarity += 4
    a.grade = Grade(split_tone=_split(220, 18 * skin, 210, 10 * skin, 10))
    return a


def _vibrant_pop(a: Adjustments, s: SceneStats, skin: float) -> Adjustments:
    a.color.vibrance += 26 * skin
    a.color.saturation += 12 * skin
    a.light.contrast += 16
    a.detail.clarity += 10
    a.detail.texture += 6
    return a


def _golden(a: Adjustments, s: SceneStats, skin: float) -> Adjustments:
    a.color.temperature = _clamp(a.color.temperature + 14, -40, 40)
    a.light.exposure = _clamp(a.light.exposure + 0.1, -1.2, 1.2)
    a.light.highlights -= 8
    a.color.vibrance += 8 * skin
    a.grade = Grade(
        split_tone=_split(40, 10 * skin, 48, 22, 0),
        color_balance=ColorBalance(highlights=ColorWheel(r=8, g=4, b=-8)),
    )
    return a


def _mono(a: Adjustments, s: SceneStats, skin: float) -> Adjustments:
    a.color.saturation = -100   # full desaturation (skin-independent — it's B&W)
    a.light.contrast += 20
    a.light.blacks -= 8
    a.detail.clarity += 12
    a.effects.grain += 12
    return a


_LOOKS = [
    ("natural", "Natural Balance",
     "Corrects the cast and balances tone — true-to-life colour.", "#9aa3ad", _natural),
    ("warm_cinematic", "Warm Cinematic",
     "Teal-and-orange film look: warm skin, cool shadows, soft contrast.", "#e08a3c", _warm_cinematic),
    ("cool_editorial", "Cool Editorial",
     "Cool, muted magazine grade with lifted matte blacks.", "#5b7fa6", _cool_editorial),
    ("vibrant_pop", "Vibrant Pop",
     "Punchy contrast and vibrance for social-ready colour.", "#d1497c", _vibrant_pop),
    ("golden", "Golden Warmth",
     "Golden-hour warmth with soft highlights.", "#d9a441", _golden),
    ("mono", "Mono Contrast",
     "High-contrast black & white with fine grain.", "#8a8f94", _mono),
]


def _round(a: Adjustments) -> Adjustments:
    for group in ("light", "color", "detail", "effects"):
        g = getattr(a, group)
        for field in type(g).model_fields:
            v = getattr(g, field)
            if isinstance(v, (int, float)):
                setattr(g, field, round(float(v), 2))
    return a


def _scene_summary(s: SceneStats, skin: float) -> dict:
    cast = "warm" if s.temp_bias > 0.015 else "cool" if s.temp_bias < -0.015 else "neutral"
    brightness = "dark" if s.mean_luma < 0.33 else "bright" if s.mean_luma > 0.62 else "balanced"
    saturation = "muted" if s.sat_mean < 0.14 else "vivid" if s.sat_mean > 0.34 else "moderate"
    if s.mean_luma < 0.33 and s.contrast > 0.22:
        mood = "moody"
    elif s.sat_mean > 0.3 and s.mean_luma > 0.5:
        mood = "vivid"
    elif s.sat_mean < 0.14:
        mood = "muted"
    else:
        mood = "neutral"
    return {
        "brightness": brightness,
        "cast": cast,
        "saturation": saturation,
        "skin": bool(skin > 0.12),
        "mood": mood,
    }


def color_match(img: np.ndarray) -> dict:
    """Analyze ``img`` and return scene tags + a list of editable grading cards."""
    s = analyze_scene(img)
    skin_frac = _skin_fraction(img)
    # Protection factor: at ~>30 % skin, damp saturation/warmth moves to ~0.45.
    skin_protect = float(_clamp(1.0 - skin_frac * 1.8, 0.4, 1.0))

    cards = []
    for cid, title, desc, accent, builder in _LOOKS:
        a = builder(_base_correction(s), s, skin_protect)
        cards.append({
            "id": cid,
            "title": title,
            "description": desc,
            "accent": accent,
            "adjustments": _round(a),
        })
    return {"scene": _scene_summary(s, skin_frac), "cards": cards}
