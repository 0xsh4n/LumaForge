"""Tests for Portrait Studio: retouch engine, masks and detection (Phase 3)."""
from __future__ import annotations

import os

import numpy as np
import pytest

from app.imaging import portrait as pm
from app.schemas import Adjustments, PortraitAdjust
from app.imaging import pipeline
from tests.test_pipeline import make_test_image


def _fake_masks(h: int, w: int) -> dict:
    """A skin region in the center; background elsewhere."""
    skin = np.zeros((h, w), np.float32)
    skin[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4] = 1.0
    zero = np.zeros((h, w), np.float32)
    return {
        "face": skin.copy(), "skin": skin, "eyes": zero.copy(), "teeth": zero.copy(),
        "hair": zero.copy(), "undereye": zero.copy(), "background": 1.0 - skin,
    }


def _noisy_face(h=200, w=200):
    rng = np.random.default_rng(1)
    base = np.full((h, w, 3), [0.75, 0.6, 0.55], np.float32)  # skin-ish
    return np.clip(base + rng.normal(0, 0.05, (h, w, 3)), 0, 1).astype(np.float32)


def test_portrait_disabled_is_identity():
    img = make_test_image()
    out = pipeline.render(img, Adjustments())  # portrait disabled by default
    assert np.allclose(out, img, atol=1e-5)


def test_skin_smoothing_only_affects_mask():
    img = _noisy_face()
    masks = _fake_masks(*img.shape[:2])
    p = PortraitAdjust(enabled=True, skin_smoothing=80, intensity=100)
    out = pm.apply_portrait(img, p, masks)
    assert out.shape == img.shape and out.min() >= 0 and out.max() <= 1
    # Inside the skin region: noise is reduced (lower local variance).
    inside_in = img[80:120, 80:120]
    inside_out = out[80:120, 80:120]
    assert inside_out.std() < inside_in.std()
    # Outside the mask (corner): unchanged.
    assert np.allclose(img[0:20, 0:20], out[0:20, 0:20], atol=1e-3)


def test_intensity_scales_effect():
    img = _noisy_face()
    masks = _fake_masks(*img.shape[:2])
    full = pm.apply_portrait(img, PortraitAdjust(enabled=True, skin_smoothing=80, intensity=100), masks)
    half = pm.apply_portrait(img, PortraitAdjust(enabled=True, skin_smoothing=80, intensity=50), masks)
    d_full = np.abs(full - img).mean()
    d_half = np.abs(half - img).mean()
    assert d_half < d_full


def test_naturalness_keeps_more_texture():
    img = _noisy_face()
    masks = _fake_masks(*img.shape[:2])
    aggressive = pm.apply_portrait(img, PortraitAdjust(enabled=True, skin_smoothing=80, naturalness=0), masks)
    natural = pm.apply_portrait(img, PortraitAdjust(enabled=True, skin_smoothing=80, naturalness=100), masks)
    # Higher naturalness → closer to the original (more texture retained).
    assert np.abs(natural - img).mean() < np.abs(aggressive - img).mean()


def test_all_modes_validate():
    for mid, params in pm.PORTRAIT_MODES.items():
        PortraitAdjust.model_validate(params)
        assert params["enabled"] is True


def test_background_ops_only_affect_background():
    img = _noisy_face()
    masks = _fake_masks(*img.shape[:2])
    p = PortraitAdjust(enabled=True, background_exposure=80, intensity=100)
    out = pm.apply_portrait(img, p, masks)
    # center (skin) unchanged, corner (bg) brightened
    assert np.allclose(img[95:105, 95:105], out[95:105, 95:105], atol=1e-3)
    assert out[0:20, 0:20].mean() > img[0:20, 0:20].mean()


# ----------------------------- detection ---------------------------------

FACE_SAMPLE = os.environ.get("LUMETTA_TEST_FACE")


@pytest.mark.skipif(not FACE_SAMPLE or not os.path.exists(FACE_SAMPLE),
                    reason="no sample face image (set LUMETTA_TEST_FACE)")
def test_face_detection_and_masks():
    from app.imaging import face as facemod
    from app.imaging import io as imgio

    if not facemod.model_available():
        pytest.skip("face model not installed")
    img, _ = imgio.load_image(FACE_SAMPLE)
    faces = facemod.detect_faces(img)
    assert len(faces) >= 1
    f = faces[0]
    assert 0 <= f.x <= 1 and 0 <= f.y <= 1 and len(f.landmarks) == 5
    masks = facemod.build_masks(img, faces)
    for key in ("skin", "eyes", "teeth", "hair", "face", "background"):
        assert masks[key].shape == img.shape[:2]
    assert masks["skin"].sum() > 0  # some skin detected
    # A full portrait render stays valid.
    a = Adjustments()
    a.portrait = PortraitAdjust(enabled=True, skin_smoothing=50, eye_enhance=40, teeth_whiten=30)
    out = pipeline.render(img, a, faces=faces)
    assert out.shape == img.shape and out.min() >= 0 and out.max() <= 1
