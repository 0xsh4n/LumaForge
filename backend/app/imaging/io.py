"""Image decode / encode / save with format and metadata handling.

Decoding goes through Pillow (broad format coverage, EXIF orientation, optional
HEIC) and yields a float32 RGB array; RAW files go through rawpy when it is
installed. Encoding for previews uses OpenCV (fast in-memory JPEG/PNG), while
file export goes through Pillow so we can control quality, metadata and the
embedded colour profile.
"""
from __future__ import annotations

import io
from pathlib import Path
from typing import Optional

import cv2
import numpy as np
from PIL import Image, ImageOps

from .color import to_float, to_uint8, to_uint16

# ---- optional codecs: detected once, reported to the UI as capabilities ----
try:  # HEIC/HEIF
    import pillow_heif  # type: ignore

    pillow_heif.register_heif_opener()
    HEIF_AVAILABLE = True
except Exception:  # pragma: no cover - environment dependent
    HEIF_AVAILABLE = False

try:  # RAW
    import rawpy  # type: ignore  # noqa: F401

    RAW_AVAILABLE = True
except Exception:  # pragma: no cover - environment dependent
    RAW_AVAILABLE = False

RASTER_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
HEIF_EXTS = {".heic", ".heif"}
RAW_EXTS = {".dng", ".cr2", ".cr3", ".nef", ".arw", ".raf", ".rw2", ".orf", ".pef", ".srw", ".raw"}

_EXIF_TAGS = {
    271: "camera_make",
    272: "camera_model",
    306: "datetime",
    33434: "exposure_time",
    33437: "f_number",
    34855: "iso",
    37386: "focal_length",
    274: "orientation",
}


def supported_extensions() -> dict:
    exts = sorted(RASTER_EXTS)
    if HEIF_AVAILABLE:
        exts += sorted(HEIF_EXTS)
    if RAW_AVAILABLE:
        exts += sorted(RAW_EXTS)
    return {
        "raster": sorted(RASTER_EXTS),
        "heif": sorted(HEIF_EXTS),
        "raw": sorted(RAW_EXTS),
        "heif_available": HEIF_AVAILABLE,
        "raw_available": RAW_AVAILABLE,
        "all_importable": exts,
    }


class UnsupportedImage(Exception):
    pass


def _extract_exif(pil_img: Image.Image) -> dict:
    out: dict = {}
    try:
        exif = pil_img.getexif()
    except Exception:
        return out
    for tag_id, name in _EXIF_TAGS.items():
        if tag_id in exif:
            val = exif[tag_id]
            try:
                out[name] = str(val)
            except Exception:
                pass
    return out


def _pil_to_float(pil_img: Image.Image) -> tuple[np.ndarray, int]:
    """Return (float32 RGB [0,1], source_bit_depth)."""
    pil_img = ImageOps.exif_transpose(pil_img)  # honour camera orientation
    mode = pil_img.mode
    if mode in ("I;16", "I;16B", "I;16L", "I"):
        arr = np.asarray(pil_img).astype(np.uint16)
        rgb = np.stack([arr, arr, arr], axis=-1)
        return to_float(rgb), 16
    if mode == "RGBA" or mode == "LA" or mode == "PA":
        pil_img = pil_img.convert("RGB")  # drop alpha for editing
    elif mode != "RGB":
        pil_img = pil_img.convert("RGB")
    arr = np.asarray(pil_img)
    bit_depth = 16 if arr.dtype == np.uint16 else 8
    return to_float(arr), bit_depth


def load_image(path: str | Path) -> tuple[np.ndarray, dict]:
    """Decode a file to (float32 RGB [0,1], metadata dict)."""
    p = Path(path)
    if not p.exists():
        raise UnsupportedImage(f"File not found: {p}")
    ext = p.suffix.lower()

    if ext in RAW_EXTS:
        from . import raw as rawdev

        if not rawdev.RAW_AVAILABLE:
            raise UnsupportedImage(
                "RAW support is not installed. Install the 'rawpy' package "
                "(pip install rawpy) to open camera RAW files."
            )
        try:
            img, meta = rawdev.develop_raw(p, None)
        except rawdev.RawError as e:
            raise UnsupportedImage(str(e))
        return img, meta  # develop_raw returns complete metadata
    elif ext in HEIF_EXTS and not HEIF_AVAILABLE:
        raise UnsupportedImage(
            "HEIC/HEIF support is not installed on this platform "
            "(pip install pillow-heif)."
        )
    else:
        with Image.open(p) as pil_img:
            pil_img.load()
            fmt = pil_img.format or ext.lstrip(".").upper()
            exif = _extract_exif(pil_img)
            img, bit_depth = _pil_to_float(pil_img)
        meta = {"format": fmt, "bit_depth": bit_depth, "exif": exif}

    h, w = img.shape[:2]
    meta.update({
        "filename": p.name,
        "source_path": str(p),
        "width": w,
        "height": h,
        "channels": 3,
        "megapixels": round(w * h / 1e6, 2),
    })
    return img, meta


def decode_upload(data: bytes, filename: str) -> tuple[np.ndarray, dict]:
    """Decode an uploaded (multipart) image from bytes."""
    ext = Path(filename).suffix.lower()
    if ext in RAW_EXTS:
        raise UnsupportedImage(
            "RAW files must be opened by path, not uploaded, so the decoder can "
            "stream them."
        )
    with Image.open(io.BytesIO(data)) as pil_img:
        pil_img.load()
        fmt = pil_img.format or ext.lstrip(".").upper()
        exif = _extract_exif(pil_img)
        img, bit_depth = _pil_to_float(pil_img)
    h, w = img.shape[:2]
    return img, {
        "filename": filename,
        "source_path": None,
        "format": fmt,
        "bit_depth": bit_depth,
        "exif": exif,
        "width": w,
        "height": h,
        "channels": 3,
        "megapixels": round(w * h / 1e6, 2),
    }


def read_exif_bytes(path: str | Path) -> Optional[bytes]:
    """Best-effort raw EXIF block for re-embedding on export."""
    try:
        with Image.open(path) as im:
            data = im.info.get("exif")
            if data:
                return data
            exif = im.getexif()
            return exif.tobytes() if len(exif) else None
    except Exception:
        return None


def downscale_to(img: np.ndarray, max_dim: Optional[int]) -> tuple[np.ndarray, float]:
    """Return (image fitted to max_dim, scale applied). Never upscales."""
    h, w = img.shape[:2]
    long_edge = max(h, w)
    if not max_dim or long_edge <= max_dim:
        return img, 1.0
    scale = max_dim / float(long_edge)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_AREA)
    return resized, scale


def encode_preview(img: np.ndarray, fmt: str = "jpeg", quality: int = 90) -> bytes:
    """Fast in-memory encode for previews. ``img`` is float32 RGB [0,1]."""
    bgr = cv2.cvtColor(to_uint8(img), cv2.COLOR_RGB2BGR)
    if fmt == "png":
        ok, buf = cv2.imencode(".png", bgr, [cv2.IMWRITE_PNG_COMPRESSION, 3])
    else:
        ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, int(quality)])
    if not ok:
        raise RuntimeError("Failed to encode preview")
    return buf.tobytes()


def _srgb_icc_bytes() -> Optional[bytes]:
    try:
        from PIL import ImageCms

        profile = ImageCms.createProfile("sRGB")
        return ImageCms.ImageCmsProfile(profile).tobytes()
    except Exception:  # pragma: no cover
        return None


def save_image(
    img: np.ndarray,
    path: str | Path,
    fmt: str = "jpeg",
    quality: int = 92,
    keep_metadata: bool = True,
    embed_srgb_profile: bool = True,
    exif_bytes: Optional[bytes] = None,
) -> dict:
    """Write a float32 RGB [0,1] image to disk. Returns a small result dict."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    fmt = fmt.lower()

    save_kwargs: dict = {}
    if embed_srgb_profile:
        icc = _srgb_icc_bytes()
        if icc:
            save_kwargs["icc_profile"] = icc
    if keep_metadata and exif_bytes:
        save_kwargs["exif"] = exif_bytes

    if fmt == "tiff":
        # 16-bit RGB TIFF for maximum fidelity. Pillow's fromarray cannot build
        # an RGB;16 image, so OpenCV writes this path (ICC/EXIF embedding is not
        # applied to 16-bit TIFF — the pixels are the deliverable here).
        bgr16 = cv2.cvtColor(to_uint16(img), cv2.COLOR_RGB2BGR)
        params = []
        tiff_lzw = getattr(cv2, "IMWRITE_TIFF_COMPRESSION", None)
        if tiff_lzw is not None:
            params = [tiff_lzw, 5]  # 5 = LZW in libtiff
        if not cv2.imwrite(str(p), bgr16, params):
            raise UnsupportedImage("Failed to write TIFF")
    else:
        pil = Image.fromarray(to_uint8(img), mode="RGB")
        if fmt in ("jpg", "jpeg"):
            pil.save(p, format="JPEG", quality=int(quality), subsampling=0,
                     optimize=True, **save_kwargs)
        elif fmt == "png":
            pil.save(p, format="PNG", compress_level=6, **save_kwargs)
        elif fmt == "webp":
            pil.save(p, format="WEBP", quality=int(quality), method=4, **save_kwargs)
        else:
            raise UnsupportedImage(f"Unsupported export format: {fmt}")

    h, w = img.shape[:2]
    return {
        "path": str(p),
        "width": w,
        "height": h,
        "bytes_written": p.stat().st_size,
        "format": fmt,
    }
