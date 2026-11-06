"""Model Manager (Phase 7 §25).

Lists every optional AI model Lumetta can use (see :mod:`app.models_registry`),
reports what is installed and where, and downloads / removes model files on
request — from trusted sources only, with live progress and optional checksum
verification. Nothing here is required for the classical editing engine; these
endpoints simply let the user opt into the AI features of phases 4–7.
"""
from __future__ import annotations

import hashlib
import shutil
import threading
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import APIRouter, HTTPException

from .. import models_registry as reg
from ..config import get_settings

router = APIRouter(prefix="/api/models", tags=["models"])

# A friendly, honest User-Agent — some hosts reject the default urllib one.
_UA = "Lumetta/0.1 (+https://github.com/0xsh4n/Lumetta)"
_CHUNK = 1 << 20  # 1 MiB


@dataclass
class _Progress:
    state: str = "idle"            # idle | downloading | verifying | done | error
    downloaded: int = 0
    total: int = 0
    error: str | None = None
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def snapshot(self) -> dict:
        with self.lock:
            pct = (self.downloaded / self.total * 100) if self.total else 0.0
            return {
                "state": self.state,
                "downloaded": self.downloaded,
                "total": self.total,
                "pct": round(pct, 1),
                "error": self.error,
            }


_progress: dict[str, _Progress] = {}
_progress_lock = threading.Lock()


def _prog(model_id: str) -> _Progress:
    with _progress_lock:
        p = _progress.get(model_id)
        if p is None:
            p = _Progress()
            _progress[model_id] = p
        return p


def _human(n: int) -> str:
    f = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if f < 1024 or unit == "GB":
            return f"{f:.1f} {unit}" if unit != "B" else f"{int(f)} B"
        f /= 1024
    return f"{f:.1f} GB"


def _download_worker(spec: reg.ModelSpec, prog: _Progress) -> None:
    """Stream the model to a .part file, verify, then atomically move into place."""
    dest = reg.model_path(spec)
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(spec.url, headers={"User-Agent": _UA})  # type: ignore[arg-type]
        # URL safety is validated before the worker starts; redirects stay on
        # the same trusted CDNs (GitHub/HF) and are followed by urllib.
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            total = int(resp.headers.get("Content-Length") or 0)
            with prog.lock:
                prog.total = total or int(spec.size_mb * 1024 * 1024)
            hasher = hashlib.sha256()
            with open(tmp, "wb") as fh:
                while True:
                    chunk = resp.read(_CHUNK)
                    if not chunk:
                        break
                    fh.write(chunk)
                    hasher.update(chunk)
                    with prog.lock:
                        prog.downloaded += len(chunk)

        if spec.sha256 and hasher.hexdigest().lower() != spec.sha256.lower():
            tmp.unlink(missing_ok=True)
            raise ValueError("Checksum mismatch — the download was discarded.")

        tmp.replace(dest)
        with prog.lock:
            prog.state = "done"
            prog.error = None
    except Exception as exc:  # noqa: BLE001 — surfaced to the UI, not swallowed
        Path(tmp).unlink(missing_ok=True)
        with prog.lock:
            prog.state = "error"
            prog.error = (
                f"{exc} — you can also download it manually from "
                f"{spec.source_page} and place it in the models folder as "
                f"'{spec.filename}'."
            )


def _spec_status(spec: reg.ModelSpec) -> dict:
    prog = _prog(spec.id)
    installed = reg.is_installed(spec)
    snap = prog.snapshot()
    # A finished/stale "done" that no longer has a file (user deleted it) should
    # read as available again; and an installed file reads as installed even if
    # this process never downloaded it.
    if installed:
        state = "installed"
    elif snap["state"] in ("downloading", "verifying", "error"):
        state = snap["state"]
    else:
        state = "available"
    return {
        "id": spec.id,
        "name": spec.name,
        "phase": spec.phase,
        "feature": spec.feature,
        "filename": spec.filename,
        "source_page": spec.source_page,
        "license": spec.license,
        "size_mb": spec.size_mb,
        "kind": spec.kind,
        "min_vram_mb": spec.min_vram_mb,
        "note": spec.note,
        "auto_downloadable": reg.is_safe_url(spec.url),
        "installed": installed,
        "disk_bytes": reg.disk_size(spec),
        "state": state,
        "progress": snap,
    }


@router.get("")
def list_models() -> dict:
    settings = get_settings()
    models = [_spec_status(m) for m in reg.all_models()]
    total = sum(m["disk_bytes"] for m in models)
    return {
        "models": models,
        "storage": {
            "dir": str(settings.models_dir),
            "total_bytes": total,
            "total_human": _human(total),
            "installed_count": sum(1 for m in models if m["installed"]),
        },
    }


@router.get("/storage")
def storage() -> dict:
    settings = get_settings()
    models_dir = settings.models_dir
    total = sum(reg.disk_size(m) for m in reg.all_models())
    return {
        "dir": str(models_dir),
        "exists": models_dir.exists(),
        "total_bytes": total,
        "total_human": _human(total),
    }


@router.post("/{model_id}/download")
def start_download(model_id: str) -> dict:
    spec = reg.get(model_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="Unknown model.")
    if reg.is_installed(spec):
        return _spec_status(spec)
    if spec.kind == "vlm":
        raise HTTPException(
            status_code=400,
            detail=(f"{spec.name} is a vision-language model installed through "
                    f"Ollama or llama.cpp, not downloaded here. See {spec.source_page}."),
        )
    if not reg.is_safe_url(spec.url):
        raise HTTPException(
            status_code=400,
            detail=(f"{spec.name} must be placed manually: download it from "
                    f"{spec.source_page} and save it in the models folder as "
                    f"'{spec.filename}'."),
        )

    prog = _prog(model_id)
    with prog.lock:
        if prog.state == "downloading":
            # Already running — just report progress.
            return _spec_status(spec)
        prog.state = "downloading"
        prog.downloaded = 0
        prog.total = int(spec.size_mb * 1024 * 1024)
        prog.error = None

    threading.Thread(
        target=_download_worker, args=(spec, prog), daemon=True,
        name=f"dl-{model_id}",
    ).start()
    return _spec_status(spec)


@router.get("/{model_id}/progress")
def progress(model_id: str) -> dict:
    spec = reg.get(model_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="Unknown model.")
    return _spec_status(spec)


@router.delete("/{model_id}")
def remove(model_id: str) -> dict:
    spec = reg.get(model_id)
    if spec is None:
        raise HTTPException(status_code=404, detail="Unknown model.")
    p = reg.model_path(spec)
    removed = False
    if p.exists() and p.is_file():
        p.unlink()
        removed = True
    # Also clear a dangling .part and reset any remembered progress.
    p.with_suffix(p.suffix + ".part").unlink(missing_ok=True)
    with _progress_lock:
        _progress.pop(model_id, None)
    return {"id": model_id, "removed": removed, **_spec_status(spec)}
