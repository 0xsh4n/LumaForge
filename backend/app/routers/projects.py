"""Project persistence: save/open .lfp files and track recent projects.

A project stores only a reference to the original image plus the adjustment
parameters — never the pixels — so originals are never rewritten and projects
stay tiny.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Body, HTTPException

from .. import __version__
from ..config import get_settings
from ..schemas import Adjustments, ProjectFile

router = APIRouter(prefix="/api/projects", tags=["projects"])

RECENT_FILE = "recent.json"
MAX_RECENT = 20


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _recent_path() -> Path:
    return get_settings().data_dir / RECENT_FILE


def _load_recent() -> list[dict]:
    p = _recent_path()
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text())
    except Exception:
        return []


def _push_recent(path: str, name: str) -> None:
    recent = [r for r in _load_recent() if r.get("path") != path]
    recent.insert(0, {"path": path, "name": name, "opened_at": _now()})
    _recent_path().write_text(json.dumps(recent[:MAX_RECENT], indent=2))


@router.get("/recent")
def recent_projects() -> list[dict]:
    # Drop entries whose files have disappeared.
    return [r for r in _load_recent() if Path(r["path"]).exists()]


@router.post("/save", response_model=ProjectFile)
def save_project(
    path: str = Body(...),
    name: str = Body(...),
    source_path: str | None = Body(default=None),
    original_width: int = Body(...),
    original_height: int = Body(...),
    adjustments: Adjustments = Body(...),
    created_at: str | None = Body(default=None),
) -> ProjectFile:
    p = Path(path)
    if p.suffix.lower() != ".lfp":
        p = p.with_suffix(".lfp")
    project = ProjectFile(
        app_version=__version__,
        name=name,
        source_path=source_path,
        original_width=original_width,
        original_height=original_height,
        adjustments=adjustments,
        created_at=created_at or _now(),
        modified_at=_now(),
    )
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(project.model_dump_json(indent=2))
    _push_recent(str(p), name)
    return project


@router.post("/open", response_model=ProjectFile)
def open_project(path: str = Body(..., embed=True)) -> ProjectFile:
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Project file not found")
    try:
        project = ProjectFile.model_validate_json(p.read_text())
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid project file: {e}")
    _push_recent(str(p), project.name)
    return project
