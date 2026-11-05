"""Portrait retouch — classical, mask-driven, identity-preserving (Phase 3).

Every operation adjusts tone/colour/detail only *within* the facial region masks
from :mod:`app.imaging.face`. There is no generative face synthesis and no
geometry change, so the result reads as a professionally retouched photo of the
same person rather than an AI-generated face. ``intensity`` is a master blend
back toward the original; ``naturalness`` keeps skin texture and tempers
smoothing.
"""
from __future__ import annotations

import cv2
import numpy as np

from ..schemas import PortraitAdjust
from .adjustments import _gaussian
from .color import luminance

EPS = 1e-6


def _blend(base: np.ndarray, edited: np.ndarray, mask: np.ndarray) -> np.ndarray:
    m = mask[..., None]
    return base * (1.0 - m) + edited * m


def _skin_retouch(img, masks, p: PortraitAdjust) -> np.ndarray:
    if p.skin_smoothing <= 0 and p.blemish_removal <= 0:
        return img
    skin = masks["skin"]
    nat = p.naturalness / 100.0
    amount = (p.skin_smoothing / 100.0) * (1.0 - 0.35 * nat)
    tex = min(1.0, p.texture_preservation / 100.0 + 0.5 * nat)

    # frequency separation: edge-preserving low frequency + detail high frequency
    low = cv2.bilateralFilter(np.ascontiguousarray(img), d=0, sigmaColor=0.08, sigmaSpace=7)
    if p.blemish_removal > 0:
        med = cv2.medianBlur(np.ascontiguousarray((low * 255).astype(np.uint8)), 5).astype(np.float32) / 255
        low = low * (1 - p.blemish_removal / 100.0) + med * (p.blemish_removal / 100.0)
    high = img - low
    smoothed = np.clip(low + high * tex, 0, 1)
    out = img * (1 - amount) + smoothed * amount
    return _blend(img, out, skin)


def _eyes(img, masks, p: PortraitAdjust) -> np.ndarray:
    out = img
    eyes = masks["eyes"]
    if p.eye_enhance > 0:
        s = p.eye_enhance / 100.0
        hp = img - _gaussian(img, 1.2)
        sharp = np.clip(img + hp * (s * 1.5), 0, 1)
        out = _blend(out, sharp, eyes * 0.9)
    if p.eye_brightness > 0:
        b = p.eye_brightness / 100.0 * 0.25
        out = _blend(out, np.clip(out + b, 0, 1), eyes)
    return out


def _teeth(img, masks, p: PortraitAdjust) -> np.ndarray:
    if p.teeth_whiten <= 0:
        return img
    s = p.teeth_whiten / 100.0
    L = luminance(img)[..., None]
    # reduce yellow (pull toward neutral) and brighten
    desat = L + (img - L) * (1.0 - 0.6 * s)
    whiter = np.clip(desat + 0.06 * s, 0, 1)
    return _blend(img, whiter, masks["teeth"])


def _under_eye(img, masks, p: PortraitAdjust) -> np.ndarray:
    if p.under_eye <= 0:
        return img
    s = p.under_eye / 100.0
    L = luminance(img)
    dark = np.clip(0.5 - L, 0, 1)[..., None]  # only lift darker pixels
    lifted = np.clip(img + 0.25 * s * dark, 0, 1)
    return _blend(img, lifted, masks["undereye"])


def _face_tone(img, masks, p: PortraitAdjust) -> np.ndarray:
    out = img
    if p.face_exposure != 0:
        out = _blend(out, np.clip(out + (p.face_exposure / 100.0) * 0.3, 0, 1), masks["face"])
    if p.face_noise_reduction > 0:
        s = p.face_noise_reduction / 100.0
        nr = cv2.bilateralFilter(np.ascontiguousarray(out), d=0, sigmaColor=0.05 + 0.1 * s, sigmaSpace=5)
        out = _blend(out, nr, masks["skin"] * s)
    if p.face_sharpen > 0:
        s = p.face_sharpen / 100.0
        hp = out - _gaussian(out, 1.4)
        out = _blend(out, np.clip(out + hp * (s * 1.3), 0, 1), masks["skin"] * 0.8)
    return out


def _hair(img, masks, p: PortraitAdjust) -> np.ndarray:
    if p.hair_enhance <= 0:
        return img
    s = p.hair_enhance / 100.0
    hp = img - _gaussian(img, 1.6)
    enhanced = np.clip(img + hp * (s * 1.4), 0, 1)
    return _blend(img, enhanced, masks["hair"])


def _background(img, masks, p: PortraitAdjust) -> np.ndarray:
    out = img
    bg = masks["background"]
    if p.background_exposure != 0:
        out = _blend(out, np.clip(out + (p.background_exposure / 100.0) * 0.3, 0, 1), bg)
    if p.background_saturation != 0:
        L = luminance(out)[..., None]
        sat = np.clip(L + (out - L) * (1.0 + p.background_saturation / 100.0), 0, 1)
        out = _blend(out, sat, bg)
    return out


def apply_portrait(img: np.ndarray, p: PortraitAdjust, masks: dict) -> np.ndarray:
    """Apply the full retouch within masks, blended by intensity."""
    if not p.enabled:
        return img
    out = _skin_retouch(img, masks, p)
    out = _under_eye(out, masks, p)
    out = _face_tone(out, masks, p)
    out = _eyes(out, masks, p)
    out = _teeth(out, masks, p)
    out = _hair(out, masks, p)
    out = _background(out, masks, p)
    # intensity = master blend back toward the original
    i = p.intensity / 100.0
    return np.clip(img * (1.0 - i) + out * i, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Portrait Studio mode profiles (editable starting points)
# ---------------------------------------------------------------------------

def _profile(**kw) -> dict:
    base = PortraitAdjust(enabled=True).model_dump()
    base.update(kw)
    return base


PORTRAIT_MODES: dict[str, dict] = {
    "natural": _profile(skin_smoothing=25, texture_preservation=72, eye_enhance=18,
                        teeth_whiten=10, naturalness=82),
    "professional": _profile(skin_smoothing=35, texture_preservation=62, eye_enhance=28,
                             teeth_whiten=20, face_sharpen=24, under_eye=20, naturalness=70),
    "studio": _profile(skin_smoothing=45, texture_preservation=55, eye_enhance=34,
                       teeth_whiten=26, eye_brightness=18, face_exposure=8,
                       background_exposure=6, naturalness=62),
    "cinematic": _profile(skin_smoothing=30, texture_preservation=65, eye_enhance=24,
                          face_exposure=-4, background_exposure=-16, background_saturation=-22,
                          naturalness=66),
    "editorial": _profile(skin_smoothing=40, texture_preservation=66, eye_enhance=40,
                          teeth_whiten=18, face_sharpen=30, hair_enhance=25, naturalness=60),
    "beauty": _profile(skin_smoothing=60, texture_preservation=45, blemish_removal=45,
                       eye_enhance=42, eye_brightness=26, teeth_whiten=35, under_eye=42,
                       naturalness=48),
    "environmental": _profile(skin_smoothing=20, texture_preservation=78, eye_enhance=16,
                              background_saturation=6, naturalness=85),
    "corporate": _profile(skin_smoothing=35, texture_preservation=60, eye_enhance=26,
                          teeth_whiten=24, under_eye=36, face_sharpen=18,
                          background_exposure=6, naturalness=70),
    "outdoor": _profile(skin_smoothing=26, texture_preservation=70, eye_enhance=22,
                        face_exposure=6, background_saturation=12, naturalness=76),
    "night": _profile(skin_smoothing=30, texture_preservation=62, eye_enhance=24,
                      face_exposure=12, face_noise_reduction=42, background_exposure=-10,
                      naturalness=64),
}

PORTRAIT_MODE_LABELS = {
    "natural": "Natural Portrait", "professional": "Professional Portrait",
    "studio": "Studio Portrait", "cinematic": "Cinematic Portrait",
    "editorial": "Editorial Portrait", "beauty": "Beauty Portrait",
    "environmental": "Environmental Portrait", "corporate": "Corporate Headshot",
    "outdoor": "Outdoor Portrait", "night": "Night Portrait",
}
