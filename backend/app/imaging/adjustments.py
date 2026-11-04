"""Real, parameter-driven image adjustments.

Each function takes and returns a float32 RGB image in [0, 1]. Operations that
are physically meaningful in linear light (exposure, white balance) say so;
everything else works in the display-referred domain where its slider feel
matches a photographer's intuition.

The math here is intentionally conservative — the product brief calls for
*natural* results, so tonal moves preserve colour ratios (luminance-delta
method), sharpening is edge-masked to avoid halos, and nothing is a hard clip
where a soft roll-off reads better.
"""
from __future__ import annotations

from functools import lru_cache

import cv2
import numpy as np

from .color import (
    LUMA_WEIGHTS,
    linear_to_srgb,
    luminance,
    srgb_to_linear,
)

EPS = 1e-6


def _smoothstep01(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0 + EPS), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _gaussian(img: np.ndarray, sigma: float) -> np.ndarray:
    sigma = max(sigma, 0.3)
    return cv2.GaussianBlur(img, (0, 0), sigmaX=sigma, sigmaY=sigma,
                            borderType=cv2.BORDER_REFLECT)


def _gaussian_big(img: np.ndarray, sigma: float) -> np.ndarray:
    """Large-sigma Gaussian via downscale→blur→upscale.

    For the big radii used by clarity/dehaze the result is low-frequency, so
    computing the blur on a shrunken copy is visually identical and dramatically
    cheaper than a full-resolution convolution.
    """
    if sigma <= 8.0:
        return _gaussian(img, sigma)
    f = sigma / 4.0
    h, w = img.shape[:2]
    sw, sh = max(1, round(w / f)), max(1, round(h / f))
    small = cv2.resize(img, (sw, sh), interpolation=cv2.INTER_AREA)
    small = _gaussian(small, sigma / f)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)


# ---------------------------------------------------------------------------
# White balance + exposure (linear light)
# ---------------------------------------------------------------------------


def _wb_gains(temperature: float, tint: float) -> np.ndarray:
    """Luminance-normalised channel gains for temperature/tint."""
    t = temperature / 100.0
    ti = tint / 100.0
    gains = np.array([1.0 + 0.30 * t, 1.0 - 0.20 * ti, 1.0 - 0.30 * t], dtype=np.float32)
    gains /= max(float(LUMA_WEIGHTS @ gains), EPS)  # preserve luminance
    return gains


def apply_wb_exposure(img: np.ndarray, temperature: float, tint: float, ev: float) -> np.ndarray:
    """White balance + exposure in a single linear-light round-trip.

    Both are physically a multiply in linear light, so doing them together
    halves the (comparatively expensive) sRGB⇄linear conversions per render.
    """
    if temperature == 0 and tint == 0 and ev == 0:
        return img
    lin = srgb_to_linear(img)
    if temperature != 0 or tint != 0:
        lin *= _wb_gains(temperature, tint)
    if ev != 0:
        lin *= float(2.0 ** ev)
    return linear_to_srgb(lin)


def apply_white_balance(img: np.ndarray, temperature: float, tint: float) -> np.ndarray:
    """Temperature/tint only (kept for standalone use & tests)."""
    return apply_wb_exposure(img, temperature, tint, 0.0)


def apply_exposure(img: np.ndarray, ev: float) -> np.ndarray:
    """Exposure in EV stops only (kept for standalone use & tests)."""
    return apply_wb_exposure(img, 0.0, 0.0, ev)


# ---------------------------------------------------------------------------
# Tone: contrast + highlights / shadows / whites / blacks
# ---------------------------------------------------------------------------


def apply_tone(
    img: np.ndarray,
    contrast: float,
    highlights: float,
    shadows: float,
    whites: float,
    blacks: float,
) -> np.ndarray:
    """Luminance-preserving tonal adjustments.

    A single luminance target is computed and the resulting delta is added to
    all three channels, which preserves hue/colour ratios and avoids the
    channel-clipping saturation shifts of per-channel curves.
    """
    if contrast == highlights == shadows == whites == blacks == 0:
        return img

    L = luminance(img)
    c = contrast / 100.0
    hi = highlights / 100.0
    sh = shadows / 100.0
    wh = whites / 100.0
    bl = blacks / 100.0

    # Contrast: blend toward a smoothstep S-curve about mid-grey.
    Lc = L + c * (_smoothstep01(L) - L)

    # Region weights (smooth, overlapping) over the contrasted luminance.
    w_sh = (1.0 - Lc) ** 2
    w_hi = Lc ** 2
    w_bl = _smoothstep(0.35, 0.0, Lc)   # strongest in deep shadows
    w_wh = _smoothstep(0.65, 1.0, Lc)   # strongest in bright highlights

    Lt = Lc + sh * 0.45 * w_sh + hi * 0.45 * w_hi + bl * 0.30 * w_bl + wh * 0.30 * w_wh
    Lt = np.clip(Lt, 0.0, 1.0)

    delta = (Lt - L)[..., None]
    return np.clip(img + delta, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Colour: vibrance, saturation, hue
# ---------------------------------------------------------------------------


def apply_color(img: np.ndarray, vibrance: float, saturation: float, hue: float) -> np.ndarray:
    out = img
    if vibrance != 0 or saturation != 0:
        s = saturation / 100.0
        v = vibrance / 100.0
        L = luminance(out)[..., None]
        chroma = out - L
        if v != 0:
            # Current saturation per pixel (0..1): protect already-vivid areas.
            cur_sat = (out.max(axis=2) - out.min(axis=2))[..., None]
            factor = (1.0 + s) * (1.0 + v * (1.0 - cur_sat))
        else:
            factor = np.float32(1.0 + s)
        out = np.clip(L + chroma * factor, 0.0, 1.0)

    if hue != 0:
        hsv = cv2.cvtColor(out, cv2.COLOR_RGB2HSV)  # H in [0,360]
        hsv[..., 0] = np.mod(hsv[..., 0] + hue, 360.0)
        out = np.clip(cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB), 0.0, 1.0)
    return out


# ---------------------------------------------------------------------------
# Local contrast: texture, clarity, dehaze
# ---------------------------------------------------------------------------


def apply_local_contrast(
    img: np.ndarray, texture: float, clarity: float, dehaze: float
) -> np.ndarray:
    if texture == 0 and clarity == 0 and dehaze == 0:
        return img

    h, w = img.shape[:2]
    long_edge = max(h, w)
    L = luminance(img)
    delta = np.zeros_like(L)

    if texture != 0:
        sigma = max(0.8, 0.003 * long_edge)
        delta += (texture / 100.0) * 0.8 * (L - _gaussian(L, sigma))
    if clarity != 0:
        sigma = max(2.0, 0.02 * long_edge)
        delta += (clarity / 100.0) * 0.6 * (L - _gaussian_big(L, sigma))

    out = img
    if dehaze != 0:
        d = dehaze / 100.0
        sigma = max(3.0, 0.05 * long_edge)
        delta += d * 0.5 * (L - _gaussian_big(L, sigma))
        # Dehaze also lifts colour saturation and deepens the base a little.
        Lc = luminance(out)[..., None]
        out = np.clip(Lc + (out - Lc) * (1.0 + 0.25 * d), 0.0, 1.0)

    return np.clip(out + delta[..., None], 0.0, 1.0)


# ---------------------------------------------------------------------------
# Noise reduction + sharpening
# ---------------------------------------------------------------------------


def apply_noise_reduction(img: np.ndarray, strength: float, px_scale: float = 1.0) -> np.ndarray:
    if strength <= 0:
        return img
    s = strength / 100.0
    sigma_color = 0.04 + 0.10 * s
    # A fixed, small spatial window keeps the bilateral filter's cost ~linear in
    # pixels (its cost grows with the window squared). ``d`` tracks resolution a
    # little so export denoising stays close to the preview, but is capped so a
    # full-resolution export does not become pathologically slow.
    sigma_space = 2.0 + 3.0 * px_scale
    d = int(np.clip(round(2.0 * sigma_space), 5, 9))
    filtered = cv2.bilateralFilter(
        np.ascontiguousarray(img), d=d, sigmaColor=sigma_color, sigmaSpace=sigma_space
    )
    return np.clip(img * (1.0 - s) + filtered * s, 0.0, 1.0)


def apply_sharpen(
    img: np.ndarray,
    amount: float,
    radius: float,
    detail: float,
    masking: float,
    px_scale: float = 1.0,
) -> np.ndarray:
    """Edge-masked unsharp mask with a detail (fine/coarse) blend.

    ``masking`` restricts sharpening to edges so flat areas (skies, skin) are
    not sharpened, which is the main defence against amplifying noise and
    producing halos.
    """
    if amount <= 0:
        return img

    a = amount / 100.0
    r = max(0.3, radius * px_scale)
    d = detail / 100.0

    coarse = img - _gaussian(img, r)
    fine = img - _gaussian(img, r * 0.5)
    highpass = coarse * (1.0 - d) + fine * d

    if masking > 0:
        m = masking / 100.0
        L = luminance(img).astype(np.float32)
        gx = cv2.Sobel(L, cv2.CV_32F, 1, 0, ksize=3)
        gy = cv2.Sobel(L, cv2.CV_32F, 0, 1, ksize=3)
        edge = cv2.magnitude(gx, gy)
        if edge.max() > EPS:
            edge /= edge.max()
        edge = _gaussian(edge, 1.0 * px_scale + 0.3)
        mask = _smoothstep(0.02 + 0.25 * m, 0.1 + 0.45 * m, edge)[..., None]
        highpass = highpass * mask

    return np.clip(img + highpass * (a * 2.0), 0.0, 1.0)


# ---------------------------------------------------------------------------
# Effects: vignette, grain
# ---------------------------------------------------------------------------


@lru_cache(maxsize=8)
def _vignette_falloff(h: int, w: int) -> np.ndarray:
    """Radial 0→1 corner-weight map. Depends only on dimensions, so cached."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    aspect = w / float(h)
    nx = (xx - cx) / (w / 2.0) * (aspect if aspect > 1 else 1.0)
    ny = (yy - cy) / (h / 2.0) * (1.0 if aspect > 1 else 1.0 / aspect)
    r = np.sqrt(nx * nx + ny * ny) / 1.4142
    return _smoothstep(0.25, 1.0, r).astype(np.float32)


def apply_vignette(img: np.ndarray, amount: float) -> np.ndarray:
    """Positive darkens the corners, negative brightens them."""
    if amount == 0:
        return img
    v = amount / 100.0
    h, w = img.shape[:2]
    falloff = _vignette_falloff(h, w)
    factor = (1.0 - v * 0.8 * falloff)[..., None]
    return np.clip(img * factor, 0.0, 1.0)


def apply_grain(img: np.ndarray, amount: float, seed: int = 12345) -> np.ndarray:
    if amount <= 0:
        return img
    g = amount / 100.0
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(img.shape[:2]).astype(np.float32) * (g * 0.06)
    L = luminance(img)
    midtone = 1.0 - (2.0 * L - 1.0) ** 2  # grain most visible in midtones
    return np.clip(img + (noise * midtone)[..., None], 0.0, 1.0)
