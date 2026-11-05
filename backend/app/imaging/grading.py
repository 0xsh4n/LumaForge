"""Professional colour-grading operations (Phase 2b — Color Studio).

Curves, 8-band HSL, 3-way colour balance, split toning, and 3D/1D `.cube` LUT
application. All operate on float32 RGB [0,1] and, like the rest of the engine,
are parameter-driven and non-destructive.
"""
from __future__ import annotations

import numpy as np

from ..schemas import ColorBalance, CurvesAdjust, Grade, HSLAdjust, SplitTone
from .color import luminance

EPS = 1e-6

# Lightroom-style hue band centers (degrees).
HSL_CENTERS = {
    "red": 0.0, "orange": 30.0, "yellow": 60.0, "green": 120.0,
    "aqua": 180.0, "blue": 240.0, "purple": 280.0, "magenta": 320.0,
}
HSL_WIDTH = 50.0  # degrees of influence on each side


# --------------------------------------------------------------------------
# Curves
# --------------------------------------------------------------------------

def _is_linear(points: list[list[float]]) -> bool:
    return (
        len(points) == 2
        and abs(points[0][0]) < 1e-6 and abs(points[0][1]) < 1e-6
        and abs(points[1][0] - 1) < 1e-6 and abs(points[1][1] - 1) < 1e-6
    )


def _curve_lut(points: list[list[float]], n: int = 1024) -> np.ndarray:
    pts = sorted(points, key=lambda p: p[0])
    xs = np.array([p[0] for p in pts], dtype=np.float32)
    ys = np.array([p[1] for p in pts], dtype=np.float32)
    grid = np.linspace(0.0, 1.0, n, dtype=np.float32)
    return np.clip(np.interp(grid, xs, ys), 0.0, 1.0).astype(np.float32)


def _apply_channel_lut(ch: np.ndarray, lut: np.ndarray) -> np.ndarray:
    n = lut.shape[0]
    idx = np.clip(ch, 0.0, 1.0) * (n - 1)
    i0 = idx.astype(np.int32)
    frac = idx - i0
    i1 = np.minimum(i0 + 1, n - 1)
    return (lut[i0] * (1.0 - frac) + lut[i1] * frac).astype(np.float32)


def apply_curves(img: np.ndarray, c: CurvesAdjust) -> np.ndarray:
    out = img
    # Per-channel first, then the master RGB curve on all channels.
    for ci, pts in enumerate((c.red, c.green, c.blue)):
        if not _is_linear(pts):
            if out is img:
                out = img.copy()
            out[..., ci] = _apply_channel_lut(out[..., ci], _curve_lut(pts))
    if not _is_linear(c.rgb):
        lut = _curve_lut(c.rgb)
        out = np.stack([_apply_channel_lut(out[..., i], lut) for i in range(3)], axis=-1)
    return out


# --------------------------------------------------------------------------
# HSL (8 bands)
# --------------------------------------------------------------------------

def _band_weight(hue: np.ndarray, center: float) -> np.ndarray:
    d = np.abs(hue - center)
    d = np.minimum(d, 360.0 - d)  # circular distance
    t = np.clip(d / HSL_WIDTH, 0.0, 1.0)
    return np.cos(t * (np.pi / 2.0)) ** 2  # smooth 1→0 window


def apply_hsl(img: np.ndarray, hsl: HSLAdjust) -> np.ndarray:
    bands = {name: getattr(hsl, name) for name in HSL_CENTERS}
    if all(b.hue == 0 and b.saturation == 0 and b.luminance == 0 for b in bands.values()):
        return img

    hsv = _rgb_to_hsv(img)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    hue_shift = np.zeros_like(H)
    sat_f = np.ones_like(S)
    lum_f = np.ones_like(V)

    for name, band in bands.items():
        if band.hue == 0 and band.saturation == 0 and band.luminance == 0:
            continue
        w = _band_weight(H, HSL_CENTERS[name])
        if band.hue:
            hue_shift += w * (band.hue / 100.0) * 30.0
        if band.saturation:
            sat_f += w * (band.saturation / 100.0)
        if band.luminance:
            lum_f += w * (band.luminance / 100.0) * 0.6

    H = np.mod(H + hue_shift, 360.0)
    S = np.clip(S * sat_f, 0.0, 1.0)
    V = np.clip(V * lum_f, 0.0, 1.0)
    return _hsv_to_rgb(np.stack([H, S, V], axis=-1))


# --------------------------------------------------------------------------
# 3-way colour balance
# --------------------------------------------------------------------------

def apply_color_balance(img: np.ndarray, cb: ColorBalance) -> np.ndarray:
    zones = (cb.shadows, cb.midtones, cb.highlights, cb.globe)
    if all(z.r == 0 and z.g == 0 and z.b == 0 and z.luminance == 0 for z in zones):
        return img

    L = luminance(img)
    w_sh = ((1.0 - L) ** 2)[..., None]
    w_hi = (L ** 2)[..., None]
    w_mid = (1.0 - np.abs(2.0 * L - 1.0))[..., None]
    out = img.copy()

    def push(zone, weight):
        nonlocal out
        rgb = np.array([zone.r, zone.g, zone.b], dtype=np.float32) / 100.0 * 0.15
        out = out + rgb * weight
        if zone.luminance:
            out = out + (zone.luminance / 100.0 * 0.2) * weight

    push(cb.shadows, w_sh)
    push(cb.midtones, w_mid)
    push(cb.highlights, w_hi)
    # global applies uniformly
    g = cb.globe
    out = out + np.array([g.r, g.g, g.b], dtype=np.float32) / 100.0 * 0.15
    if g.luminance:
        out = out + g.luminance / 100.0 * 0.2
    return np.clip(out, 0.0, 1.0)


# --------------------------------------------------------------------------
# Split toning
# --------------------------------------------------------------------------

def _hue_sat_to_rgb(hue: float, sat: float) -> np.ndarray:
    hsv = np.array([[[hue, sat, 1.0]]], dtype=np.float32)
    return _hsv_to_rgb(hsv)[0, 0]


def apply_split_tone(img: np.ndarray, st: SplitTone) -> np.ndarray:
    if st.shadow_sat == 0 and st.highlight_sat == 0:
        return img
    L = luminance(img)
    pivot = 0.5 + (st.balance / 100.0) * 0.4
    w_sh = (np.clip((pivot - L) / max(pivot, EPS), 0.0, 1.0) ** 1.5)[..., None]
    w_hi = (np.clip((L - pivot) / max(1.0 - pivot, EPS), 0.0, 1.0) ** 1.5)[..., None]
    out = img
    if st.shadow_sat:
        tint = _hue_sat_to_rgb(st.shadow_hue, st.shadow_sat / 100.0)
        out = out + (tint - L[..., None]) * (st.shadow_sat / 100.0 * 0.35) * w_sh
    if st.highlight_sat:
        tint = _hue_sat_to_rgb(st.highlight_hue, st.highlight_sat / 100.0)
        out = out + (tint - L[..., None]) * (st.highlight_sat / 100.0 * 0.35) * w_hi
    return np.clip(out, 0.0, 1.0)


# --------------------------------------------------------------------------
# 3D / 1D .cube LUT
# --------------------------------------------------------------------------

def apply_lut(img: np.ndarray, lut: dict, intensity: float = 100.0) -> np.ndarray:
    """Apply a parsed .cube LUT (see parse_cube) with 0..100 intensity blend."""
    if intensity <= 0:
        return img
    if lut["dim"] == 1:
        table = lut["data"]  # (N,3)
        n = table.shape[0]
        graded = np.stack(
            [_apply_channel_lut(img[..., i], table[:, i]) for i in range(3)], axis=-1
        )
    else:
        graded = _apply_lut3d(img, lut["data"], lut["size"])
    t = np.clip(intensity / 100.0, 0.0, 1.0)
    return np.clip(img * (1.0 - t) + graded * t, 0.0, 1.0)


def _apply_lut3d(img: np.ndarray, table: np.ndarray, n: int) -> np.ndarray:
    """Trilinear interpolation into an (n,n,n,3) LUT. table indexed [r,g,b]."""
    pos = np.clip(img, 0.0, 1.0) * (n - 1)
    i0 = np.floor(pos).astype(np.int32)
    i1 = np.minimum(i0 + 1, n - 1)
    f = (pos - i0).astype(np.float32)
    r0, g0, b0 = i0[..., 0], i0[..., 1], i0[..., 2]
    r1, g1, b1 = i1[..., 0], i1[..., 1], i1[..., 2]
    fr, fg, fb = f[..., 0:1], f[..., 1:2], f[..., 2:3]

    def T(r, g, b):
        return table[r, g, b]

    c00 = T(r0, g0, b0) * (1 - fr) + T(r1, g0, b0) * fr
    c01 = T(r0, g0, b1) * (1 - fr) + T(r1, g0, b1) * fr
    c10 = T(r0, g1, b0) * (1 - fr) + T(r1, g1, b0) * fr
    c11 = T(r0, g1, b1) * (1 - fr) + T(r1, g1, b1) * fr
    c0 = c00 * (1 - fg) + c10 * fg
    c1 = c01 * (1 - fg) + c11 * fg
    return (c0 * (1 - fb) + c1 * fb).astype(np.float32)


def parse_cube(text: str) -> dict:
    """Parse a .cube LUT file into {dim, size, data}. Raises ValueError on bad input."""
    size = None
    dim = 3
    values: list[list[float]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        key = line.split()[0].upper()
        if key == "LUT_3D_SIZE":
            size = int(line.split()[1]); dim = 3
        elif key == "LUT_1D_SIZE":
            size = int(line.split()[1]); dim = 1
        elif key in ("TITLE", "DOMAIN_MIN", "DOMAIN_MAX", "LUT_3D_INPUT_RANGE",
                     "LUT_1D_INPUT_RANGE"):
            continue
        else:
            parts = line.split()
            if len(parts) == 3:
                try:
                    values.append([float(parts[0]), float(parts[1]), float(parts[2])])
                except ValueError:
                    continue
    if size is None or not values:
        raise ValueError("Not a valid .cube LUT (missing size or data)")
    data = np.array(values, dtype=np.float32)
    if dim == 1:
        if data.shape[0] != size:
            raise ValueError("1D LUT data length does not match LUT_1D_SIZE")
        return {"dim": 1, "size": size, "data": data}
    if data.shape[0] != size ** 3:
        raise ValueError("3D LUT data length does not match LUT_3D_SIZE")
    # .cube ordering: red changes fastest → reshape to [b,g,r,3] then transpose to [r,g,b,3]
    table = data.reshape(size, size, size, 3)  # [b, g, r, 3]
    table = np.transpose(table, (2, 1, 0, 3))  # → [r, g, b, 3]
    return {"dim": 3, "size": size, "data": np.ascontiguousarray(table)}


def write_cube(samples: np.ndarray, size: int, title: str = "LumaForge") -> str:
    """Serialize an (size^3, 3) graded-lattice array to .cube text (red fastest)."""
    lines = [f'TITLE "{title}"', f"LUT_3D_SIZE {size}", ""]
    for row in samples:
        lines.append(f"{row[0]:.6f} {row[1]:.6f} {row[2]:.6f}")
    return "\n".join(lines) + "\n"


def identity_lattice(size: int) -> np.ndarray:
    """An (size,size,size,3) identity image whose rows iterate red fastest."""
    axis = np.linspace(0.0, 1.0, size, dtype=np.float32)
    b, g, r = np.meshgrid(axis, axis, axis, indexing="ij")
    return np.stack([r, g, b], axis=-1)  # [b,g,r,3] ordering matches .cube rows


# --------------------------------------------------------------------------
# HSV helpers (keep hue in degrees, S/V in [0,1])
# --------------------------------------------------------------------------

import cv2  # noqa: E402  (placed here to keep the color math grouped above)


def _rgb_to_hsv(img: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(np.ascontiguousarray(img), cv2.COLOR_RGB2HSV)


def _hsv_to_rgb(hsv: np.ndarray) -> np.ndarray:
    return np.clip(cv2.cvtColor(np.ascontiguousarray(hsv), cv2.COLOR_HSV2RGB), 0.0, 1.0)


def apply_grade(img: np.ndarray, grade: Grade, lut_resolver=None) -> np.ndarray:
    """Apply the full grading stack. ``lut_resolver`` maps lut_id → parsed LUT dict."""
    out = apply_curves(img, grade.curves)
    out = apply_hsl(out, grade.hsl)
    out = apply_color_balance(out, grade.color_balance)
    out = apply_split_tone(out, grade.split_tone)
    if grade.lut_id and lut_resolver is not None:
        lut = lut_resolver(grade.lut_id)
        if lut is not None:
            out = apply_lut(out, lut, grade.lut_intensity)
    return np.clip(out, 0.0, 1.0)
