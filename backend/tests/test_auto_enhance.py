"""Tests for the Auto Enhance profile generator (Phase 2)."""
from __future__ import annotations

import numpy as np
import pytest

from app.imaging.auto_enhance import auto_enhance
from app.schemas import Adjustments
from tests.test_pipeline import make_test_image


def dark_image():
    return np.clip(make_test_image() * 0.35, 0, 1).astype(np.float32)


def bright_image():
    return np.clip(make_test_image() * 0.6 + 0.4, 0, 1).astype(np.float32)


def cool_cast_image():
    img = make_test_image().copy()
    img[..., 2] = np.clip(img[..., 2] * 1.25 + 0.08, 0, 1)  # push blue up
    img[..., 0] = np.clip(img[..., 0] * 0.9, 0, 1)
    return img.astype(np.float32)


def flat_image():
    # low contrast, raised blacks, desaturated → hazy
    return (np.clip(make_test_image() * 0.4 + 0.35, 0, 1) * 0.6 + 0.2).astype(np.float32)


def test_result_is_schema_valid_and_bounded():
    for mode in ("natural", "professional", "cinematic"):
        res = auto_enhance(make_test_image(), mode, 100)
        # Re-validating through the schema enforces every field's min/max.
        Adjustments.model_validate(res["adjustments"].model_dump())


def test_underexposed_brightens():
    res = auto_enhance(dark_image(), "natural", 100)
    assert res["adjustments"].light.exposure > 0.1


def test_overexposed_does_not_brighten():
    res = auto_enhance(bright_image(), "natural", 100)
    assert res["adjustments"].light.exposure <= 0.05


def test_cool_cast_is_warmed():
    res = auto_enhance(cool_cast_image(), "natural", 100)
    assert res["adjustments"].color.temperature > 3  # positive = warmer


def test_flat_image_gets_contrast():
    res = auto_enhance(flat_image(), "natural", 100)
    assert res["adjustments"].light.contrast > 3


def test_strength_zero_is_neutral():
    res = auto_enhance(dark_image(), "natural", 0)
    a = res["adjustments"]
    neutral = Adjustments()
    assert a.model_dump() == neutral.model_dump()


def test_strength_scales_linearly():
    full = auto_enhance(dark_image(), "natural", 100)["adjustments"].light.exposure
    half = auto_enhance(dark_image(), "natural", 50)["adjustments"].light.exposure
    assert full != 0
    assert abs(half - full * 0.5) < 0.02


def test_profiles_are_adaptive():
    # Different images must yield different exposure corrections.
    e_dark = auto_enhance(dark_image(), "natural", 100)["adjustments"].light.exposure
    e_bright = auto_enhance(bright_image(), "natural", 100)["adjustments"].light.exposure
    assert abs(e_dark - e_bright) > 0.3


def test_modes_differ():
    img = make_test_image()
    nat = auto_enhance(img, "natural", 100)["adjustments"]
    cine = auto_enhance(img, "cinematic", 100)["adjustments"]
    # Cinematic adds a vignette; natural does not.
    assert cine.effects.vignette > nat.effects.vignette


def test_notes_present():
    res = auto_enhance(dark_image(), "natural", 100)
    assert isinstance(res["notes"], list) and len(res["notes"]) >= 1


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def test_api_auto_enhance(client, tmp_path):
    from PIL import Image
    src = tmp_path / "src.png"
    Image.fromarray((dark_image() * 255).astype(np.uint8)).save(src)
    image_id = client.post("/api/images/import-path", json={"path": str(src)}).json()["id"]

    r = client.post(f"/api/images/{image_id}/auto-enhance",
                    json={"mode": "professional", "strength": 80})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["adjustments"]["light"]["exposure"] > 0
    assert "notes" in body and body["mode"] == "professional"
