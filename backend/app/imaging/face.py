"""Face detection (YuNet) and facial region masks for Portrait Studio.

Detection uses OpenCV's bundled YuNet model (a ~230 KB ONNX downloaded once to
the models directory). From each face's box + 5 landmarks we derive feathered
masks for skin, eyes, teeth, hair, the whole face, and the background — using
skin-colour segmentation to refine the skin region. Everything downstream only
adjusts tone/colour/detail *within* these masks, so facial geometry and identity
are never changed.
"""
from __future__ import annotations

import threading
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from ..config import get_settings
from .color import to_uint8

YUNET_FILE = "face_detection_yunet_2023mar.onnx"
YUNET_URL = (
    "https://media.githubusercontent.com/media/opencv/opencv_zoo/main/"
    "models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

_lock = threading.Lock()
_detector = None  # lazily created cv2.FaceDetectorYN


@dataclass
class Face:
    """Face geometry, normalized to [0,1] so masks rebuild at any resolution."""

    x: float
    y: float
    w: float
    h: float
    landmarks: list[tuple[float, float]]  # right_eye, left_eye, nose, r_mouth, l_mouth
    score: float


def model_path() -> Path:
    return get_settings().models_dir / YUNET_FILE


def model_available() -> bool:
    p = model_path()
    return p.exists() and p.stat().st_size > 100_000


def ensure_model() -> bool:
    """Download the YuNet model if missing. Returns True if available."""
    if model_available():
        return True
    p = model_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        urllib.request.urlretrieve(YUNET_URL, p)  # noqa: S310 (fixed trusted URL)
    except Exception:
        return False
    return model_available()


def _get_detector(w: int, h: int):
    global _detector
    with _lock:
        if _detector is None:
            if not model_available():
                raise FaceError("Face detection model is not installed.")
            _detector = cv2.FaceDetectorYN.create(str(model_path()), "", (w, h),
                                                   score_threshold=0.6, nms_threshold=0.3)
        _detector.setInputSize((w, h))
        return _detector


class FaceError(Exception):
    pass


def detect_faces(img: np.ndarray, max_dim: int = 1024) -> list[Face]:
    """Detect faces in a float32 RGB [0,1] image. Returns normalized Face list."""
    h0, w0 = img.shape[:2]
    scale = min(1.0, max_dim / max(h0, w0))
    if scale < 1.0:
        small = cv2.resize(to_uint8(img), (round(w0 * scale), round(h0 * scale)),
                           interpolation=cv2.INTER_AREA)
    else:
        small = to_uint8(img)
    bgr = cv2.cvtColor(small, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]
    det = _get_detector(w, h)
    _, faces = det.detect(bgr)
    out: list[Face] = []
    if faces is None:
        return out
    for f in faces:
        out.append(Face(
            x=float(f[0]) / w, y=float(f[1]) / h,
            w=float(f[2]) / w, h=float(f[3]) / h,
            landmarks=[(float(f[4 + 2 * i]) / w, float(f[5 + 2 * i]) / h) for i in range(5)],
            score=float(f[-1]),
        ))
    return out


# ---------------------------------------------------------------------------
# Masks
# ---------------------------------------------------------------------------


def _skin_color_mask(img: np.ndarray) -> np.ndarray:
    """YCrCb skin-colour probability (float32 [0,1])."""
    ycrcb = cv2.cvtColor(to_uint8(img), cv2.COLOR_RGB2YCrCb)
    cr = ycrcb[..., 1].astype(np.float32)
    cb = ycrcb[..., 2].astype(np.float32)
    m = ((cr >= 133) & (cr <= 180) & (cb >= 77) & (cb <= 128)).astype(np.float32)
    return cv2.GaussianBlur(m, (0, 0), 2.0)


def build_masks(img: np.ndarray, faces: list[Face]) -> dict[str, np.ndarray]:
    """Build feathered float32 [0,1] masks at the image's resolution."""
    h, w = img.shape[:2]
    feather = max(2.0, 0.004 * max(h, w))
    face_m = np.zeros((h, w), np.float32)
    eyes_m = np.zeros((h, w), np.float32)
    teeth_m = np.zeros((h, w), np.float32)
    hair_m = np.zeros((h, w), np.float32)
    undereye_m = np.zeros((h, w), np.float32)

    for f in faces:
        bx, by, bw, bh = f.x * w, f.y * h, f.w * w, f.h * h
        cx, cy = bx + bw / 2, by + bh * 0.52
        ax, ay = bw * 0.62, bh * 0.72
        cv2.ellipse(face_m, (int(cx), int(cy)), (int(ax), int(ay)), 0, 0, 360, 1.0, -1)

        lm = [(px * w, py * h) for px, py in f.landmarks]
        re, le, _nose, rm, lmo = lm
        eye_d = max(8.0, np.hypot(le[0] - re[0], le[1] - re[1]))
        er = eye_d * 0.22
        for (ex, ey) in (re, le):
            cv2.circle(eyes_m, (int(ex), int(ey)), int(er), 1.0, -1)
            cv2.ellipse(undereye_m, (int(ex), int(ey + er * 1.3)),
                        (int(er * 1.1), int(er * 0.7)), 0, 0, 360, 1.0, -1)

        mcx, mcy = (rm[0] + lmo[0]) / 2, (rm[1] + lmo[1]) / 2
        mw = max(10.0, np.hypot(lmo[0] - rm[0], lmo[1] - rm[1]))
        cv2.ellipse(teeth_m, (int(mcx), int(mcy)), (int(mw * 0.6), int(mw * 0.42)),
                    0, 0, 360, 1.0, -1)

        # hair: band above and around the top of the face box
        hcx, hcy = bx + bw / 2, by - bh * 0.12
        cv2.ellipse(hair_m, (int(hcx), int(hcy)), (int(bw * 0.75), int(bh * 0.55)),
                    0, 0, 360, 1.0, -1)

    skin_prob = _skin_color_mask(img)
    # skin = face ellipse ∩ skin colour, minus eyes & mouth
    skin_m = np.clip(face_m * skin_prob - eyes_m - teeth_m, 0, 1)
    # hair = hair band minus skin colour (hair isn't skin-coloured)
    hair_m = np.clip(hair_m * (1.0 - skin_prob) - face_m * 0.5, 0, 1)
    # teeth = mouth region ∩ bright, low-saturation pixels
    hsv = cv2.cvtColor(to_uint8(img), cv2.COLOR_RGB2HSV)
    bright = ((hsv[..., 2].astype(np.float32) / 255 > 0.45) &
              (hsv[..., 1].astype(np.float32) / 255 < 0.5)).astype(np.float32)
    teeth_m = teeth_m * bright
    undereye_m = np.clip(undereye_m * skin_prob - eyes_m, 0, 1)

    def feather_map(m):
        return np.clip(cv2.GaussianBlur(m, (0, 0), feather), 0, 1)

    face_f = feather_map(face_m)
    # background = outside a dilated face/hair region
    subject = np.clip(face_m + hair_m, 0, 1)
    k = int(max(3, feather * 2)) | 1
    subject = cv2.dilate(subject, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    background = 1.0 - feather_map(subject)

    return {
        "face": face_f,
        "skin": feather_map(skin_m),
        "eyes": feather_map(eyes_m),
        "teeth": feather_map(teeth_m),
        "hair": feather_map(hair_m),
        "undereye": feather_map(undereye_m),
        "background": background,
    }
