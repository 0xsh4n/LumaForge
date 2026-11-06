"""Tests for motion & lens effects (Phase 5): directional / zoom / spin blur."""
from __future__ import annotations

import numpy as np

from app.imaging import motion
from app.imaging import pipeline
from app.schemas import Adjustments, MotionAdjust
from tests.test_pipeline import make_test_image

H, W = 120, 160


def _sharpness(img: np.ndarray) -> float:
    import cv2

    g = img.mean(axis=2).astype(np.float32)
    return float(cv2.Laplacian(g, cv2.CV_32F).var())


def test_none_is_identity():
    img = make_test_image(W, H)
    out = motion.apply_motion(img, MotionAdjust(type="none", amount=50))
    assert np.allclose(out, img)


def test_zero_amount_is_identity():
    img = make_test_image(W, H)
    out = motion.apply_motion(img, MotionAdjust(type="linear", amount=0))
    assert np.allclose(out, img)


def test_linear_blur_reduces_sharpness_and_keeps_range():
    img = make_test_image(W, H)
    out = motion.apply_motion(img, MotionAdjust(type="linear", amount=70, angle=0))
    assert out.shape == img.shape
    assert out.min() >= 0.0 and out.max() <= 1.0
    assert _sharpness(out) < _sharpness(img)


def test_linear_direction_is_anisotropic():
    # A horizontal streak should blur a vertical edge but preserve a horizontal one.
    vedge = np.zeros((H, W, 3), np.float32)
    vedge[:, : W // 2] = 1.0  # vertical boundary down the middle
    hedge = np.zeros((H, W, 3), np.float32)
    hedge[: H // 2, :] = 1.0  # horizontal boundary across the middle

    horiz = MotionAdjust(type="linear", amount=80, angle=0)
    v_blurred = motion.apply_motion(vedge, horiz)
    h_kept = motion.apply_motion(hedge, horiz)

    # Vertical edge (perpendicular to the streak) gets softened a lot…
    assert _sharpness(v_blurred) < _sharpness(vedge) * 0.6
    # …while the horizontal edge (parallel to the streak) is largely preserved.
    assert _sharpness(h_kept) > _sharpness(v_blurred)


def test_zoom_and_spin_blur_reduce_sharpness():
    img = make_test_image(W, H)
    for t in ("zoom", "spin"):
        out = motion.apply_motion(img, MotionAdjust(type=t, amount=90, cx=0.5, cy=0.5))
        assert out.shape == img.shape
        assert out.min() >= 0.0 and out.max() <= 1.0
        assert _sharpness(out) < _sharpness(img)


def test_resolution_consistency():
    # The effect is defined in fractions of the image, so a half-size render blurs
    # a comparable amount — sharpness ratio should be in the same ballpark.
    big = make_test_image(320, 240)
    small = make_test_image(160, 120)
    m = MotionAdjust(type="linear", amount=60, angle=30)
    rb = _sharpness(motion.apply_motion(big, m)) / _sharpness(big)
    rs = _sharpness(motion.apply_motion(small, m)) / _sharpness(small)
    assert abs(rb - rs) < 0.25


def test_motion_through_pipeline():
    img = make_test_image(W, H)
    a = Adjustments()
    a.motion = MotionAdjust(type="zoom", amount=60)
    out = pipeline.render(img, a)
    assert out.shape == img.shape
    assert out.min() >= 0.0 and out.max() <= 1.0
    assert not np.allclose(out, img)
