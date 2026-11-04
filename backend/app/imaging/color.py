"""Color-space helpers.

The adjustment engine deliberately does some operations in linear light (where
they are physically meaningful, e.g. exposure and white balance) and others in
the display-referred sRGB domain (where tonal/contrast moves match a
photographer's expectations). These helpers make those transitions explicit.
"""
from __future__ import annotations

import numpy as np

# Rec. 709 / sRGB luminance weights.
LUMA_WEIGHTS = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


# The exact sRGB transfer functions (power + boolean toe) are correct but far
# too slow to run on every pixel of a 12 MP image several times per render.
# We bake them into high-resolution lookup tables once and sample with linear
# interpolation — visually indistinguishable from the exact curve, but an order
# of magnitude faster and, crucially, scales linearly with pixel count.
_LUT_N = 8192


def _srgb_to_linear_exact(x: np.ndarray) -> np.ndarray:
    a = 0.055
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.04045, x / 12.92, ((x + a) / (1 + a)) ** 2.4)


def _linear_to_srgb_exact(x: np.ndarray) -> np.ndarray:
    a = 0.055
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, (1 + a) * (x ** (1 / 2.4)) - a)


_X = np.linspace(0.0, 1.0, _LUT_N, dtype=np.float32)
_LUT_S2L = _srgb_to_linear_exact(_X).astype(np.float32)
_LUT_L2S = _linear_to_srgb_exact(_X).astype(np.float32)


def _apply_lut(img: np.ndarray, lut: np.ndarray) -> np.ndarray:
    # Nearest-neighbour sampling of an 8192-entry table. At this resolution the
    # quantisation step is ~1.2e-4, below a display 8-bit code, so it is
    # visually identical to the exact curve while allocating far fewer
    # temporaries than interpolation — which matters for interactive speed.
    idx = np.clip(img, 0.0, 1.0)
    idx = idx * (_LUT_N - 1)
    np.rint(idx, out=idx)
    return lut[idx.astype(np.int32)]


def srgb_to_linear(img: np.ndarray) -> np.ndarray:
    """Convert sRGB-encoded [0,1] values to linear light (LUT-accelerated)."""
    return _apply_lut(img, _LUT_S2L)


def linear_to_srgb(img: np.ndarray) -> np.ndarray:
    """Convert linear light back to sRGB-encoded [0,1] values (LUT-accelerated)."""
    return _apply_lut(img, _LUT_L2S)


def luminance(img: np.ndarray) -> np.ndarray:
    """Per-pixel Rec.709 luminance of a display-referred RGB image → (H,W)."""
    return img @ LUMA_WEIGHTS


def to_float(img_u8: np.ndarray) -> np.ndarray:
    """uint8/uint16 RGB → float32 [0,1]."""
    if img_u8.dtype == np.uint16:
        return (img_u8.astype(np.float32)) / 65535.0
    return img_u8.astype(np.float32) / 255.0


def to_uint8(img: np.ndarray) -> np.ndarray:
    return np.clip(img * 255.0 + 0.5, 0, 255).astype(np.uint8)


def to_uint16(img: np.ndarray) -> np.ndarray:
    return np.clip(img * 65535.0 + 0.5, 0, 65535).astype(np.uint16)
