"""Image import, metadata, analysis and (base) preview endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from fastapi.concurrency import run_in_threadpool

from ..imaging import io as imgio
from ..imaging import pipeline
from ..imaging import raw as rawdev
from ..imaging import segment
from ..imaging import depth as depth_mod
from ..imaging import assistant as assistant_mod
from ..imaging.scheduler import scheduler
from ..imaging import upscale as upscale_mod
from .. import models_registry as reg
from ..schemas import (
    Adjustments,
    ImageAnalysis,
    ImageMeta,
    ImportByPathRequest,
    RawDevelopRequest,
    RawParams,
)
from ..store import store

router = APIRouter(prefix="/api/images", tags=["images"])


class AiMaskRequest(BaseModel):
    kind: str
    model: str = "birefnet_lite"


class AssistantRequest(BaseModel):
    text: str
    adjustments: Adjustments = Field(default_factory=Adjustments)


class UpscaleRequest(BaseModel):
    scale: int
    model: str = "realesrgan_x4plus"
    denoise: bool = False
    restore_faces: bool = False


@router.post("/{image_id}/assistant")
async def assistant_suggest(image_id: str, req: AssistantRequest) -> dict:
    if not store.get(image_id):
        raise HTTPException(status_code=404, detail="Image not found")
    if not req.text.strip():
        raise HTTPException(status_code=422, detail="Enter an editing request")
    adjustments, summary, notes = assistant_mod.suggest(req.text, req.adjustments)
    return {"adjustments": adjustments, "summary": summary, "source": "rules", "notes": notes}


@router.post("/{image_id}/upscale")
async def start_upscale(image_id: str, req: UpscaleRequest) -> dict:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    if req.scale not in (2, 4):
        raise HTTPException(status_code=422, detail="Scale must be 2 or 4")
    if req.model != "realesrgan_x4plus":
        raise HTTPException(status_code=422, detail="Unsupported upscaling model")
    if req.denoise or req.restore_faces:
        raise HTTPException(status_code=422, detail="Denoising and face restoration are not available in this build.")
    spec = reg.get("realesrgan_x4plus")
    if not spec or not reg.is_installed(spec):
        raise HTTPException(status_code=409, detail="Real-ESRGAN x4plus is not installed. Install it in Settings → AI models.")
    original = session.original.copy()
    def run(job):
        result, provider = upscale_mod.upscale(original, req.scale, job)
        job.provider = provider
        if job.cancel_requested:
            return
        updated = store.replace_original(image_id, result)
        if updated is None:
            raise RuntimeError("The image session closed before upscaling completed.")
    return {"job_id": scheduler.submit(run)}


@router.post("/{image_id}/depth")
async def compute_depth(image_id: str) -> dict:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    spec = reg.get("depth_anything_v2_small")
    if spec is None or not reg.is_installed(spec):
        return {"available": False, "cached": False,
                "message": "Depth Anything V2 is not installed. Install it in Settings → AI models."}
    cached = depth_mod.is_cached(image_id, session.preview_base.shape[:2])
    try:
        depth, provider = await run_in_threadpool(depth_mod.depth_map, image_id, session.preview_base)
        return {"available": True, "cached": cached, "provider": provider,
                "message": "Running on CPU (slower)." if provider.startswith("CPU") else None,
                "width": int(depth.shape[1]), "height": int(depth.shape[0])}
    except RuntimeError as exc:
        return {"available": False, "cached": False, "message": str(exc)}


@router.post("/{image_id}/ai-mask")
async def compute_ai_mask(image_id: str, req: AiMaskRequest) -> dict:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    if req.kind not in {"subject", "background", "sky"}:
        raise HTTPException(status_code=422, detail="kind must be subject, background, or sky")
    spec = reg.get(req.model)
    if spec is None or req.model not in {"birefnet_lite", "birefnet_general"}:
        raise HTTPException(status_code=422, detail="Unsupported BiRefNet model")
    cached = segment.cached_mask(image_id, req.model, req.kind, session.preview_base.shape[:2]) is not None
    if not reg.is_installed(spec):
        return {"available": False, "cached": False,
                "message": f"{spec.name} is not installed. Install BiRefNet in Settings → AI models."}
    try:
        matte = await run_in_threadpool(segment.get_mask, image_id, session.preview_base, req.model, req.kind)
        from ..imaging.inference import onnx_session
        _, provider = await run_in_threadpool(onnx_session, reg.model_path(spec))
        return {"available": True, "cached": cached, "provider": provider,
                "message": "Running on CPU (slower)." if provider.startswith("CPU") else None,
                "width": int(matte.shape[1]), "height": int(matte.shape[0])}
    except RuntimeError as exc:
        return {"available": False, "cached": False, "message": str(exc)}


def _meta_response(meta: dict) -> ImageMeta:
    return ImageMeta(
        id=meta["id"],
        filename=meta.get("filename", "image"),
        source_path=meta.get("source_path"),
        width=meta["width"],
        height=meta["height"],
        channels=meta.get("channels", 3),
        bit_depth=meta.get("bit_depth", 8),
        format=meta.get("format", "?"),
        megapixels=meta.get("megapixels", 0.0),
        exif=meta.get("exif", {}),
        is_raw=meta.get("is_raw", False),
        raw_params=meta.get("raw_params"),
    )


@router.post("/import-path", response_model=ImageMeta)
async def import_by_path(req: ImportByPathRequest) -> ImageMeta:
    try:
        img, meta = await run_in_threadpool(imgio.load_image, req.path)
    except imgio.UnsupportedImage as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to open image: {e}")
    if meta.get("is_raw"):
        raw_params = RawParams().model_dump()
        meta["raw_params"] = raw_params
        session = store.add(img, meta, raw_path=req.path, raw_params=raw_params)
    else:
        exif_bytes = await run_in_threadpool(imgio.read_exif_bytes, req.path)
        session = store.add(img, meta, exif_bytes=exif_bytes)
    return _meta_response(session.meta)


@router.post("/{image_id}/raw-develop", response_model=ImageMeta)
async def raw_develop(image_id: str, req: RawDevelopRequest) -> ImageMeta:
    """Re-decode a RAW image with new develop parameters (replaces the original)."""
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    if not session.is_raw or not session.raw_path:
        raise HTTPException(status_code=422, detail="Not a RAW image")
    try:
        img, _ = await run_in_threadpool(rawdev.develop_raw, session.raw_path, req.raw_params)
    except rawdev.RawError as e:
        raise HTTPException(status_code=422, detail=str(e))
    params = req.raw_params.model_dump()
    updated = store.redevelop(image_id, img, params)
    assert updated is not None
    updated.meta["raw_params"] = params
    return _meta_response(updated.meta)


@router.post("/import-upload", response_model=ImageMeta)
async def import_upload(file: UploadFile) -> ImageMeta:
    data = await file.read()
    try:
        img, meta = await run_in_threadpool(
            imgio.decode_upload, data, file.filename or "upload"
        )
    except imgio.UnsupportedImage as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to decode upload: {e}")
    session = store.add(img, meta)
    return _meta_response(session.meta)


@router.get("/{image_id}", response_model=ImageMeta)
def get_meta(image_id: str) -> ImageMeta:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    return _meta_response(session.meta)


@router.delete("/{image_id}")
def close_image(image_id: str) -> dict:
    return {"closed": store.remove(image_id)}


@router.get("/{image_id}/original")
async def original_preview(
    image_id: str,
    max_dim: int = Query(default=0, ge=0, le=20000),
    quality: int = Query(default=90, ge=1, le=100),
) -> Response:
    """The untouched original, as a JPEG, for the before/original view."""
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    base = session.preview_base
    if max_dim:
        base, _ = await run_in_threadpool(imgio.downscale_to, base, max_dim)
    data = await run_in_threadpool(imgio.encode_preview, base, "jpeg", quality)
    return Response(content=data, media_type="image/jpeg")


@router.get("/{image_id}/analyze", response_model=ImageAnalysis)
async def analyze_image(image_id: str) -> ImageAnalysis:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    stats = await run_in_threadpool(pipeline.analyze, session.preview_base)
    return ImageAnalysis(**stats)
