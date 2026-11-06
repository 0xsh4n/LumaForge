"""Rendering (interactive preview) and export.

Both routes run through the identical :func:`app.imaging.pipeline.render`. The
only differences are the input resolution (a cached preview copy vs the
full-resolution original) and ``px_scale``, which keeps pixel-defined effects
consistent between what you preview and what you export.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
import numpy as np

from ..config import get_settings
from ..imaging import io as imgio
from ..imaging import pipeline
from ..imaging import segment
from ..imaging import depth as depth_mod
from ..imaging.color import to_uint8
from ..schemas import ExportRequest, ExportResult, RenderRequest
from ..store import ImageSession, store

router = APIRouter(prefix="/api/images", tags=["process"])


def _mask_sources(session: ImageSession, image: np.ndarray, masks) -> dict[str, np.ndarray]:
    result = {}
    for mask in masks:
        if mask.type.startswith("ai_"):
            kind = mask.type.removeprefix("ai_")
            model = mask.ai_model or "birefnet_lite"
            try:
                result[mask.id] = segment.get_mask(session.id, image, model, kind)
            except RuntimeError:
                # Unavailable sources render as empty selections; endpoint/UI carries the reason.
                continue
    return result


def _depth_source(session: ImageSession, image: np.ndarray, enabled: bool):
    if not enabled:
        return None, None
    try:
        depth, _provider = depth_mod.depth_map(session.id, image)
        subject = segment.cached_mask(session.id, "birefnet_lite", "subject", image.shape[:2])
        from .. import models_registry as model_registry
        spec = model_registry.get("birefnet_lite")
        if subject is None and spec is not None:
            if model_registry.is_installed(spec):
                try:
                    subject = segment.get_mask(session.id, image, "birefnet_lite", "subject")
                except RuntimeError:
                    subject = None
        return depth, subject
    except RuntimeError:
        return None, None


def _render_preview(session: ImageSession, req: RenderRequest) -> bytes:
    settings = get_settings()
    base = session.preview_base
    max_dim = req.max_dim or settings.preview_max_dim
    base, _ = imgio.downscale_to(base, max_dim)
    render_long = max(base.shape[:2])
    px_scale = render_long / float(session.original_long_edge)
    depth, subject = _depth_source(session, base, req.adjustments.depth.enabled)
    out = pipeline.render(base, req.adjustments, px_scale=px_scale, faces=session.faces,
                          mask_sources=_mask_sources(session, base, req.adjustments.masks),
                          depth_source=depth, subject_source=subject)
    return imgio.encode_preview(out, req.format, req.quality)


@router.post("/{image_id}/render")
async def render_preview(image_id: str, req: RenderRequest) -> Response:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    data = await run_in_threadpool(_render_preview, session, req)
    media = "image/png" if req.format == "png" else "image/jpeg"
    return Response(content=data, media_type=media)


def _export(session: ImageSession, req: ExportRequest) -> dict:
    original = session.original
    if req.resize_long_edge:
        base, scale = imgio.downscale_to(original, req.resize_long_edge)
        px_scale = scale
    else:
        base, px_scale = original, 1.0
    depth, subject = _depth_source(session, base, req.adjustments.depth.enabled)
    out = pipeline.render(base, req.adjustments, px_scale=px_scale, faces=session.faces,
                          mask_sources=_mask_sources(session, base, req.adjustments.masks),
                          depth_source=depth, subject_source=subject)
    return imgio.save_image(
        out, req.path, fmt=req.format, quality=req.quality,
        keep_metadata=req.keep_metadata,
        embed_srgb_profile=req.embed_srgb_profile,
        exif_bytes=session.exif_bytes if req.keep_metadata else None,
    )


@router.post("/{image_id}/export", response_model=ExportResult)
async def export_image(image_id: str, req: ExportRequest) -> ExportResult:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        result = await run_in_threadpool(_export, session, req)
    except imgio.UnsupportedImage as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")
    return ExportResult(**result)


_MEDIA = {
    "jpeg": "image/jpeg", "png": "image/png",
    "webp": "image/webp", "tiff": "image/tiff",
}


def _export_bytes(session: ImageSession, req: ExportRequest) -> tuple[bytes, str]:
    # Render + encode via a temp file so every export format (incl. 16-bit TIFF)
    # shares one code path. Used by the browser-download fallback.
    import tempfile
    from pathlib import Path

    settings = get_settings()
    tmp = Path(tempfile.mkstemp(suffix=f".{req.format}", dir=settings.cache_dir)[1])
    try:
        req2 = req.model_copy(update={"path": str(tmp)})
        _export(session, req2)
        return tmp.read_bytes(), _MEDIA.get(req.format, "application/octet-stream")
    finally:
        tmp.unlink(missing_ok=True)


@router.post("/{image_id}/export-bytes")
async def export_bytes(image_id: str, req: ExportRequest) -> Response:
    """Full-resolution export returned as bytes (browser download fallback)."""
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        data, media = await run_in_threadpool(_export_bytes, session, req)
    except imgio.UnsupportedImage as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Export failed: {e}")
    return Response(content=data, media_type=media)
