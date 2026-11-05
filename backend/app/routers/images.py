"""Image import, metadata, analysis and (base) preview endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..imaging import io as imgio
from ..imaging import pipeline
from ..imaging import raw as rawdev
from ..schemas import (
    ImageAnalysis,
    ImageMeta,
    ImportByPathRequest,
    RawDevelopRequest,
    RawParams,
)
from ..store import store

router = APIRouter(prefix="/api/images", tags=["images"])


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
