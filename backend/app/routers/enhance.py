"""Auto Enhance — adaptive, editable enhancement profiles (Phase 2)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from ..imaging.auto_enhance import auto_enhance
from ..schemas import AutoEnhanceRequest, AutoEnhanceResult
from ..store import store

router = APIRouter(prefix="/api/images", tags=["enhance"])


@router.post("/{image_id}/auto-enhance", response_model=AutoEnhanceResult)
async def auto_enhance_image(image_id: str, req: AutoEnhanceRequest) -> AutoEnhanceResult:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    # Analysis runs on the cached preview copy: representative and fast. The
    # returned parameters apply identically at full resolution on export.
    result = await run_in_threadpool(
        auto_enhance, session.preview_base, req.mode, req.strength
    )
    return AutoEnhanceResult(**result)
