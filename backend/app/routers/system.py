"""System / hardware endpoints (Settings → compatibility report)."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
import subprocess
import sys

from .. import __version__
from ..imaging import hardware

router = APIRouter(prefix="/api/system", tags=["system"])


@router.post("/ai-extras/install")
async def install_ai_extras() -> dict:
    """Install the optional CPU ONNX runtime using this backend's Python."""
    try:
        result = await run_in_threadpool(
            subprocess.run,
            [sys.executable, "-m", "pip", "install", "onnxruntime>=1.17"],
            capture_output=True, text=True, timeout=900,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"installed": False, "message": f"AI libraries could not be installed: {exc}"}
    if result.returncode:
        details = (result.stderr or result.stdout or "pip returned an error").strip()
        return {"installed": False, "message": details[-1800:]}
    return {"installed": True, "message": "ONNX Runtime installed. Model inference is ready; restart Lumetta if the runtime is not detected."}


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/hardware")
def hardware_report() -> dict:
    """Full compatibility report with a live VRAM reading."""
    return hardware.live_report()
