"""Tests for the image-processing core and the HTTP API.

These run against real synthetic photographs (gradients + coloured patches), so
they exercise the actual NumPy/OpenCV math rather than mocks.
"""
from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from app.imaging import pipeline
from app.imaging import io as imgio
from app.schemas import Adjustments


def make_test_image(w: int = 320, h: int = 240) -> np.ndarray:
    """A float32 RGB [0,1] image with a tonal gradient and colour patches."""
    x = np.linspace(0.05, 0.95, w, dtype=np.float32)
    grad = np.repeat(x[None, :], h, axis=0)
    img = np.stack([grad, grad, grad], axis=-1)
    img[: h // 3, : w // 3] = [0.8, 0.2, 0.2]   # red patch
    img[: h // 3, w // 3: 2 * w // 3] = [0.2, 0.7, 0.3]  # green patch
    img[-h // 3:, -w // 3:] = [0.2, 0.3, 0.85]  # blue patch
    return img


def test_neutral_is_near_identity():
    img = make_test_image()
    out = pipeline.render(img, Adjustments())
    assert out.shape == img.shape
    assert out.dtype == np.float32
    assert np.allclose(out, img, atol=1e-5)


def test_output_stays_in_range():
    img = make_test_image()
    a = Adjustments()
    a.light.exposure = 3.0
    a.light.contrast = 100
    a.light.shadows = 100
    a.color.saturation = 100
    a.detail.sharpen_amount = 100
    a.effects.vignette = 100
    a.effects.grain = 100
    out = pipeline.render(img, a)
    assert out.min() >= 0.0 and out.max() <= 1.0


def test_exposure_brightens():
    img = make_test_image()
    a = Adjustments()
    a.light.exposure = 1.0  # +1 EV ≈ 2x linear light
    out = pipeline.render(img, a)
    assert out.mean() > img.mean() + 0.05


def test_negative_exposure_darkens():
    img = make_test_image()
    a = Adjustments()
    a.light.exposure = -1.0
    out = pipeline.render(img, a)
    assert out.mean() < img.mean() - 0.05


def test_saturation_changes_chroma():
    img = make_test_image()
    a = Adjustments()
    a.color.saturation = -100  # fully desaturate
    out = pipeline.render(img, a)
    chroma = out.max(axis=2) - out.min(axis=2)
    assert float(chroma.mean()) < 0.02  # near grayscale


def test_white_balance_preserves_luminance_roughly():
    img = make_test_image()
    a = Adjustments()
    a.color.temperature = 60
    out = pipeline.render(img, a)
    # Luminance-normalised WB should not shift overall brightness much.
    assert abs(out.mean() - img.mean()) < 0.03
    # But it should make the image warmer (more red than blue).
    assert out[..., 0].mean() > out[..., 2].mean()


def test_contrast_increases_spread():
    img = make_test_image()
    a = Adjustments()
    a.light.contrast = 80
    out = pipeline.render(img, a)
    assert out.std() > img.std()


def test_sharpen_masking_limits_flat_areas():
    img = make_test_image()
    a = Adjustments()
    a.detail.sharpen_amount = 100
    a.detail.sharpen_masking = 90
    out = pipeline.render(img, a)
    # A flat patch (top-left red block interior) should be barely touched.
    flat_in = img[2:20, 2:20]
    flat_out = out[2:20, 2:20]
    assert np.allclose(flat_in, flat_out, atol=0.03)


def test_analyze_keys():
    img = make_test_image()
    stats = pipeline.analyze(img)
    for key in ("mean_luma", "median_luma", "black_clip_pct", "white_clip_pct",
                "contrast_std", "sharpness", "histogram"):
        assert key in stats
    assert len(stats["histogram"]["luma"]) == 256


def test_preview_matches_fullres_tonally():
    """Resolution-independent ops should match between preview and full size."""
    img = make_test_image(1200, 900)
    small, scale = imgio.downscale_to(img, 400)
    a = Adjustments()
    a.light.exposure = 0.8
    a.light.contrast = 40
    a.color.saturation = 30
    full = pipeline.render(img, a, px_scale=1.0)
    prev = pipeline.render(small, a, px_scale=scale)
    assert abs(full.mean() - prev.mean()) < 0.01


def test_roundtrip_save_load(tmp_path):
    img = make_test_image()
    out_path = tmp_path / "out.jpg"
    res = imgio.save_image(img, out_path, fmt="jpeg", quality=95)
    assert out_path.exists() and res["bytes_written"] > 0
    loaded, meta = imgio.load_image(out_path)
    assert loaded.shape == img.shape
    assert meta["width"] == img.shape[1]


def test_save_all_export_formats(tmp_path):
    img = make_test_image()
    for fmt, ext in [("jpeg", "jpg"), ("png", "png"), ("webp", "webp"), ("tiff", "tiff")]:
        p = tmp_path / f"out.{ext}"
        imgio.save_image(img, p, fmt=fmt, quality=90)
        assert p.exists() and p.stat().st_size > 0
        back, _ = imgio.load_image(p)
        assert back.shape[2] == 3


# ----------------------------- API tests ---------------------------------

@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


def test_api_health(client):
    r = client.get("/api/system/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_api_hardware_report(client):
    r = client.get("/api/system/hardware")
    assert r.status_code == 200
    body = r.json()
    assert "cpu" in body and "formats" in body
    assert body["active_processing_device"] == "cpu"


def test_api_import_render_export(client, tmp_path):
    # Create a source image on disk.
    src = tmp_path / "src.png"
    Image.fromarray((make_test_image() * 255).astype(np.uint8)).save(src)

    r = client.post("/api/images/import-path", json={"path": str(src)})
    assert r.status_code == 200, r.text
    image_id = r.json()["id"]

    r = client.post(f"/api/images/{image_id}/render",
                    json={"adjustments": {"light": {"exposure": 0.5}}})
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert len(r.content) > 100

    out = tmp_path / "export.jpg"
    r = client.post(f"/api/images/{image_id}/export",
                    json={"path": str(out), "format": "jpeg", "quality": 90,
                          "adjustments": {"light": {"exposure": 0.5}}})
    assert r.status_code == 200, r.text
    assert out.exists()
    assert r.json()["width"] == make_test_image().shape[1]


def test_api_import_bad_path(client):
    r = client.post("/api/images/import-path", json={"path": "/no/such/file.jpg"})
    assert r.status_code == 422
