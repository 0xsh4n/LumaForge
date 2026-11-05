"""Portrait Studio: face detection + mode profiles (Phase 3)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from ..imaging import face as facemod
from ..imaging.portrait import PORTRAIT_MODE_LABELS, PORTRAIT_MODES
from ..store import store

router = APIRouter(prefix="/api", tags=["portrait"])


@router.post("/images/{image_id}/detect-faces")
async def detect_faces(image_id: str) -> dict:
    session = store.get(image_id)
    if not session:
        raise HTTPException(status_code=404, detail="Image not found")
    if not facemod.model_available():
        ok = await run_in_threadpool(facemod.ensure_model)
        if not ok:
            return {"model_available": False, "count": 0, "faces": [],
                    "message": "Face model not installed and could not be downloaded (offline?)."}
    faces = await run_in_threadpool(facemod.detect_faces, session.preview_base)
    session.faces = faces
    return {
        "model_available": True,
        "count": len(faces),
        "faces": [
            {"box": [round(f.x, 4), round(f.y, 4), round(f.w, 4), round(f.h, 4)],
             "score": round(f.score, 3)}
            for f in faces
        ],
    }


@router.get("/portrait/modes")
def portrait_modes() -> list[dict]:
    return [
        {"id": mid, "label": PORTRAIT_MODE_LABELS[mid], "params": params}
        for mid, params in PORTRAIT_MODES.items()
    ]
