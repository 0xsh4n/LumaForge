"""Color grading: LUT import/list/remove and LUT export (Phase 2b)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from ..imaging import grading, pipeline
from ..lut_store import lut_store
from ..schemas import Adjustments
from ..store import store

router = APIRouter(prefix="/api", tags=["grade"])


class LutExportRequest(BaseModel):
    adjustments: Adjustments = Field(default_factory=Adjustments)
    size: int = Field(33, ge=2, le=65)


class LutExportPathRequest(LutExportRequest):
    path: str


@router.get("/luts")
def list_luts() -> list[dict]:
    return lut_store.list()


@router.post("/luts/import")
async def import_lut(file: UploadFile) -> dict:
    data = await file.read()
    try:
        parsed = grading.parse_cube(data.decode("utf-8", errors="ignore"))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid .cube LUT: {e}")
    name = (file.filename or "LUT").rsplit(".", 1)[0]
    return lut_store.add(name, parsed)


@router.delete("/luts/{lut_id}")
def remove_lut(lut_id: str) -> dict:
    return {"removed": lut_store.remove(lut_id)}


def _bake(adjustments: Adjustments, size: int) -> str:
    lattice = grading.identity_lattice(size)          # (N,N,N,3)
    flat = lattice.reshape(-1, 1, 3)                   # (N^3,1,3), red fastest
    graded = pipeline.render_color_only(flat, adjustments)
    samples = graded.reshape(-1, 3)
    return grading.write_cube(samples, size, title="LumaForge Export")


@router.post("/images/{image_id}/export-lut")
async def export_lut(image_id: str, req: LutExportRequest) -> Response:
    """Bake the current colour look into a downloadable .cube 3D LUT."""
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    text = await run_in_threadpool(_bake, req.adjustments, req.size)
    return Response(
        content=text,
        media_type="text/plain",
        headers={"Content-Disposition": 'attachment; filename="lumaforge.cube"'},
    )


@router.post("/images/{image_id}/export-lut-path")
async def export_lut_to_path(image_id: str, req: LutExportPathRequest) -> dict:
    """Bake the current look into a .cube written to ``path`` (desktop save)."""
    from pathlib import Path

    if not store.get(image_id):
        raise HTTPException(status_code=404, detail="Image not found")
    text = await run_in_threadpool(_bake, req.adjustments, req.size)
    p = Path(req.path)
    if p.suffix.lower() != ".cube":
        p = p.with_suffix(".cube")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)
    return {"path": str(p), "bytes_written": p.stat().st_size}
