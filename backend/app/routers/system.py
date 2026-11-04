"""System / hardware endpoints (Settings → compatibility report)."""
from __future__ import annotations

from fastapi import APIRouter

from .. import __version__
from ..imaging import hardware

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@router.get("/hardware")
def hardware_report() -> dict:
    """Full compatibility report with a live VRAM reading."""
    return hardware.live_report()
