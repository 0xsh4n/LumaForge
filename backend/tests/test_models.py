"""Tests for the model registry and Model Manager API (Phase 7 §25)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import models_registry as reg
from app.config import get_settings
from app.main import app


@pytest.fixture
def tmp_models(tmp_path, monkeypatch):
    """Redirect the per-user data dir to a temp folder for a test."""
    monkeypatch.setenv("LUMAFORGE_DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_settings()  # create the dirs under tmp_path
    yield tmp_path / "models"
    get_settings.cache_clear()


client = TestClient(app)


# ---- registry integrity ---------------------------------------------------


def test_model_ids_are_unique():
    ids = [m.id for m in reg.all_models()]
    assert len(ids) == len(set(ids))


def test_every_direct_url_is_safe_and_https():
    for m in reg.all_models():
        if m.url is not None:
            assert reg.is_safe_url(m.url), f"{m.id} has an unsafe URL: {m.url}"
            assert m.url.startswith("https://")


def test_specs_have_required_fields():
    # source_page is a human-facing official page (https); the download `url`
    # is what must live on the trusted-download allowlist (checked above).
    for m in reg.all_models():
        assert m.id and m.name and m.filename
        assert m.source_page.startswith("https://")
        assert m.phase in (3, 4, 5, 6, 7)
        assert m.size_mb > 0


def test_is_safe_url_rejects_untrusted():
    assert not reg.is_safe_url(None)
    assert not reg.is_safe_url("http://github.com/x")          # not https
    assert not reg.is_safe_url("https://evil.example.com/m")   # not allowlisted
    assert not reg.is_safe_url("https://github.com.evil.com/m")  # suffix trick
    assert reg.is_safe_url("https://github.com/x/y")
    assert reg.is_safe_url("https://media.githubusercontent.com/x")
    assert reg.is_safe_url("https://huggingface.co/x/resolve/main/m.safetensors")


# ---- API ------------------------------------------------------------------


def test_list_models_reports_storage_dir(tmp_models):
    r = client.get("/api/models")
    assert r.status_code == 200
    body = r.json()
    assert len(body["models"]) == len(reg.all_models())
    assert body["storage"]["dir"] == str(tmp_models)
    assert body["storage"]["installed_count"] == 0


def test_installed_flag_tracks_the_file(tmp_models):
    spec = reg.get("yunet_face")
    assert spec is not None
    # Not installed yet.
    assert reg.is_installed(spec) is False
    # Write a plausibly-sized fake file.
    tmp_models.mkdir(parents=True, exist_ok=True)
    (tmp_models / spec.filename).write_bytes(b"\0" * 200_000)
    assert reg.is_installed(spec) is True

    r = client.get("/api/models")
    entry = next(m for m in r.json()["models"] if m["id"] == "yunet_face")
    assert entry["installed"] is True
    assert entry["state"] == "installed"


def test_truncated_file_is_not_installed(tmp_models):
    spec = reg.get("yunet_face")
    tmp_models.mkdir(parents=True, exist_ok=True)
    (tmp_models / spec.filename).write_bytes(b"\0" * 1000)  # far too small
    assert reg.is_installed(spec) is False


def test_download_rejects_vlm(tmp_models):
    r = client.post("/api/models/moondream2/download")
    assert r.status_code == 400
    assert "Ollama" in r.json()["detail"]


def test_download_guides_manual_models(tmp_models):
    r = client.post("/api/models/birefnet_general/download")
    assert r.status_code == 400
    detail = r.json()["detail"]
    assert "manually" in detail and "huggingface.co" in detail


def test_delete_removes_installed_file(tmp_models):
    spec = reg.get("yunet_face")
    tmp_models.mkdir(parents=True, exist_ok=True)
    f = tmp_models / spec.filename
    f.write_bytes(b"\0" * 200_000)
    r = client.delete("/api/models/yunet_face")
    assert r.status_code == 200
    assert r.json()["removed"] is True
    assert not f.exists()


def test_unknown_model_is_404(tmp_models):
    assert client.post("/api/models/nope/download").status_code == 404
    assert client.delete("/api/models/nope").status_code == 404
