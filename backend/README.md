# LumaForge Backend

Local image-processing engine for LumaForge — a FastAPI service that performs all
analysis and pixel processing. It runs on `127.0.0.1` and is launched by the
Tauri shell as a bundled sidecar (or standalone with `uvicorn` in development).

## Run (development)

```bash
# from the repo root, after ./scripts/setup.sh
cd backend
../.venv/bin/python -m app.main --port 8756 --reload
```

Interactive API docs: <http://127.0.0.1:8756/docs>.

## Test

```bash
cd backend && ../.venv/bin/python -m pytest
```

Tests run against synthetic photographs and exercise the real NumPy/OpenCV math
and the HTTP API (import → render → export), not mocks.

## Key endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/system/health` | liveness + version |
| GET  | `/api/system/hardware` | GPU/CUDA/VRAM + format capabilities |
| POST | `/api/images/import-path` | import by filesystem path (desktop) |
| POST | `/api/images/import-upload` | import via multipart upload (browser) |
| GET  | `/api/images/{id}` | image metadata |
| GET  | `/api/images/{id}/original` | original as JPEG (before view) |
| GET  | `/api/images/{id}/analyze` | histogram + statistics |
| POST | `/api/images/{id}/render` | preview render from adjustments |
| POST | `/api/images/{id}/export` | full-res export to a path |
| POST | `/api/images/{id}/export-bytes` | full-res export as bytes (download) |
| POST | `/api/projects/save` · `/open` · GET `/recent` | project persistence |

## Layout

```
app/
├── config.py        settings (env: LUMAFORGE_*)
├── schemas.py       Adjustments + request/response models
├── store.py         in-memory non-destructive image sessions (LRU)
├── imaging/
│   ├── io.py         decode/encode/save, formats, EXIF, optional HEIC/RAW
│   ├── color.py      sRGB↔linear (LUT), luminance
│   ├── adjustments.py  real adjustment algorithms
│   ├── pipeline.py   render() + analyze()
│   └── hardware.py   GPU/CUDA/VRAM detection
├── routers/         system · images · process · projects
└── main.py          FastAPI app + sidecar entry (also run_backend.py)
```

## Packaging

`lumaforge-backend.spec` + `../scripts/build_sidecar.*` freeze this into a single
executable for the Tauri sidecar. Build on each target OS.

## Dependencies

Core (always, Phase 1): numpy, pillow, opencv-python-headless, fastapi, uvicorn,
pydantic, pydantic-settings, python-multipart. Optional: `rawpy` (RAW), 
`pillow-heif` (HEIC). AI model dependencies (PyTorch, ONNX Runtime, etc.) are
added per feature in later phases.
