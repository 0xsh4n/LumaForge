<div align="center">

<img src="logo.svg" alt="Lumetta" width="260" />

# Developer Guide

Architecture, setup, testing, building, and how to extend Lumetta.

</div>

---

## Contents

- [Overview](#overview)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running in development](#running-in-development)
- [Testing](#testing)
- [Building installers](#building-installers)
- [The non-destructive pipeline](#the-non-destructive-pipeline)
- [Backend reference](#backend-reference)
- [Frontend reference](#frontend-reference)
- [Adding a feature](#adding-a-feature)
- [AI models & the registry](#ai-models--the-registry)
- [CI & releases](#ci--releases)
- [Conventions](#conventions)

---

## Overview

Lumetta is a native desktop app made of three cooperating parts:

```
Tauri 2 shell (Rust)  ──spawns──▶  Python sidecar (FastAPI)
      │                                   ▲
   renders                                │ HTTP 127.0.0.1:8756
      ▼                                   │
React + TypeScript UI  ──────────────────┘
```

- **Shell** (`desktop/src-tauri`, Rust) owns the OS window and launches the
  Python engine as a bundled **sidecar** executable, then terminates it on exit.
- **Frontend** (`desktop/src`, React + TypeScript + Tailwind + Zustand) is a thin
  client: it holds **no image logic**, only UI state and API calls.
- **Backend** (`backend/app`, Python + FastAPI + NumPy + OpenCV + LibRaw) does
  **all** image analysis and processing. AI produces parameters/masks/maps; a
  single deterministic pipeline renders them.

The split means the UI is identical whether it runs in the native window or a
plain browser pointed at the dev server — which is what makes development easy on
any OS.

## Repository layout

```
backend/                 Python processing engine
  app/
    main.py              FastAPI app factory + sidecar entry point
    config.py            Settings (env-overridable); data/model/cache dirs
    store.py             In-memory, non-destructive image sessions (LRU)
    schemas.py           Pydantic models — the UI⇄engine contract
    models_registry.py   Trusted catalog of optional AI models
    imaging/
      pipeline.py        render(original, adjustments, px_scale, faces)
      adjustments.py     Primitive ops (exposure, tone, colour, sharpen, …)
      color.py           Colour-space helpers (luminance, sRGB⇄linear)
      auto_enhance.py    Scene analysis → editable enhancement profile
      colormatch.py      Scene analysis → editable grading looks
      grading.py         Curves / HSL / colour balance / split tone / LUTs
      raw.py             LibRaw (rawpy) develop pipeline
      face.py            YuNet detection + face-region masks
      masks.py           Linear / radial / brush masks + local adjustments
      motion.py          Directional / zoom / spin motion blur
      hardware.py        GPU / VRAM / runtime detection
    routers/             system · images · process · enhance · grade ·
                         portrait · projects · models
  tests/                 pytest suite (synthetic images, real math)
  lumetta-backend.spec   PyInstaller sidecar spec
desktop/
  src/
    types.ts             TypeScript mirror of schemas.py
    lib/                 api.ts (client) · adjustments.ts · platform.ts
    store/editorStore.ts Zustand store + render scheduler
    components/          Logo, NavRail, sliders, histogram, icons, …
    editor/              Panels (Adjust, ColorStudio, Portrait, Masks,
                         ColorMatch, RawDevelop, Preview, BottomBar, …)
    sections/            Home · Editor · AI · Presets · Settings
  src-tauri/             Rust shell, tauri.conf.json, icons, capabilities
scripts/                 setup · dev · build · build_sidecar  (.sh + .ps1)
docs/                    USER_GUIDE · DEV_GUIDE · ARCHITECTURE · INSTALL ·
                         MODELS · GPU · RELEASE · ROADMAP
models/                  dev placeholder — real models live in the user data dir
```

## Prerequisites

| Tool | Version | For |
|------|---------|-----|
| Node.js | 18+ | frontend build & dev server |
| Python | 3.10–3.14 | backend engine |
| Rust | stable (1.77+) | native Tauri shell — via [rustup](https://rustup.rs) |

Platform build dependencies for Tauri:

- **Windows** — Microsoft C++ Build Tools + WebView2 (preinstalled on Win 10/11).
- **macOS** — Xcode command-line tools.
- **Linux** — `webkit2gtk`, `libappindicator`, `librsvg`, `patchelf` (Debian/
  Ubuntu: `libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev
  libayatana-appindicator3-dev librsvg2-dev`).

## Setup

```bash
./scripts/setup.sh         # Windows: .\scripts\setup.ps1
```

Creates `.venv/`, installs backend requirements, and runs `npm install`.
Optional RAW/HEIC codecs are detected at runtime — see [INSTALL.md](INSTALL.md).

## Running in development

```bash
./scripts/dev.sh           # backend + browser UI at http://127.0.0.1:1420
./scripts/dev.sh --native  # backend + the native Tauri window
#   Windows: .\scripts\dev.ps1   /   .\scripts\dev.ps1 -Browser
```

Or run the pieces directly:

```bash
cd backend && ../.venv/bin/python -m uvicorn app.main:app --port 8756
cd desktop && npm run dev                 # Vite at http://localhost:1420
```

The React app talks to the backend at `127.0.0.1:8756`. In dev builds two
console hooks are exposed for quick manual testing:

```js
window.__LF_API__      // the typed API client
window.__LF_STORE__    // the Zustand store
window.__LF_STORE__.getState().openPath('/abs/path.jpg')  // load an image
```

> **Note:** a Linux box without WebKitGTK can't compile the Tauri *shell*, but
> the full app still runs in browser dev mode (backend + Vite) — CI builds the
> native installers per OS.

## Testing

```bash
cd backend && ../.venv/bin/python -m pytest -q    # image-engine + API tests
cd desktop && npm run build                        # tsc typecheck + Vite build
```

The backend tests run against synthetic photographs so they exercise the real
NumPy/OpenCV math, not mocks. Keep them green and add tests for every new module
(mirror `test_masks.py`, `test_motion.py`, `test_colormatch.py`).

## Building installers

Build **on the OS you're targeting** (a Windows `.msi` can only be built on
Windows, etc.):

```bash
./scripts/build.sh         # Windows: .\scripts\build.ps1
```

This freezes the backend into a sidecar executable
(`desktop/src-tauri/binaries/lumetta-backend-<target-triple>`) and builds the
native bundle:

- **Windows** → `.msi` + NSIS `.exe` under `desktop/src-tauri/target/release/bundle/`
- **Linux** → `.deb`, AppImage, `.rpm`
- **macOS** → `.dmg`

The sidecar step alone is `./scripts/build_sidecar.sh`. See [INSTALL.md](INSTALL.md)
for details and [RELEASE.md](RELEASE.md) for CI and code signing.

## The non-destructive pipeline

The heart of Lumetta is `backend/app/imaging/pipeline.py`:

```python
render(original: np.ndarray, a: Adjustments, px_scale: float = 1.0,
       faces: list | None = None) -> np.ndarray
```

- `original` is the untouched, full-resolution float32 RGB `[0,1]` image. It is
  **never mutated** — `render` returns a new array.
- `a: Adjustments` is the entire edit, as parameters (see `schemas.py`).
- `px_scale` = (this render's long edge) / (original's long edge). It's `< 1` for
  previews so spatial effects (sharpen radius, blur, noise) match the full-size
  export. **Any spatial effect you add must scale by `px_scale` or by a fraction
  of the image dimensions.**

Stage order: white balance + exposure → tone → local contrast → colour → grading
→ portrait → masks → noise reduction → sharpen → lens corrections → motion blur →
vignette → grain. Previews and exports run the exact same function at different
resolutions, so what you see is what you get.

**AI never writes pixels.** Model code produces parameters, masks or maps that
feed this pipeline, so every AI result stays editable and reversible.

## Backend reference

Key HTTP endpoints (all under `http://127.0.0.1:8756`):

| Method & path | Purpose |
|---------------|---------|
| `GET  /api/system/health` · `/hardware` | status + compatibility report |
| `POST /api/images/import-path` · `import-upload` | open an image |
| `GET  /api/images/{id}` · `/analyze` · `/original` | metadata, stats, preview |
| `POST /api/images/{id}/render` | render a preview for given adjustments |
| `POST /api/images/{id}/export` · `export-bytes` | full-res export |
| `POST /api/images/{id}/raw-develop` | re-decode a RAW with new params |
| `POST /api/images/{id}/auto-enhance` · `color-match` | editable AI profiles/looks |
| `POST /api/images/{id}/detect-faces` · `GET /api/portrait/modes` | Portrait Studio |
| `GET/POST/DELETE /api/luts…` · `export-lut…` | LUT import/export |
| `GET/POST /api/projects/recent` · `save` · `open` | `.lfp` projects |
| `GET /api/models` · `POST /{id}/download` · `DELETE /{id}` | model manager |

Settings live in `config.py` and are overridable with `LUMETTA_*` environment
variables (e.g. `LUMETTA_DATA_DIR`, `LUMETTA_PORT`). The per-user data directory
holds `models/`, `cache/` and `projects/`.

## Frontend reference

- **`types.ts`** mirrors `schemas.py` — keep them in sync.
- **`lib/api.ts`** is the one typed HTTP client; add a method per endpoint.
- **`store/editorStore.ts`** (Zustand) holds all UI state, the undo/redo history,
  and a debounced render scheduler. Panels dispatch actions here; they don't call
  the API directly for rendering.
- **Gestures & undo:** a slider drag is one undo step — `beginGesture()` on
  pointer-down, `endGesture()` on pointer-up. AI panels snapshot on open and
  commit on apply, so a whole session is a single undo step.
- **`lib/adjustments.ts`** owns `neutralAdjustments()`, deep clone, and the
  blend/scale helpers. Update it whenever you add a field to `Adjustments`.

## Adding a feature

A typical classical feature touches, in order:

1. **Backend op** — a pure function in `imaging/` that takes/returns float32 RGB
   `[0,1]` and scales spatial work by `px_scale`.
2. **Schema** — add fields to `Adjustments` in `schemas.py` (neutral defaults, so
   an empty `Adjustments()` is a no-op).
3. **Pipeline** — call your op from `pipeline.render` at the right stage.
4. **Tests** — add a `backend/tests/test_<feature>.py`.
5. **Types** — mirror the schema in `types.ts`; extend `neutralAdjustments()` and
   the clone/blend helpers in `adjustments.ts`.
6. **Store + UI** — add store actions and a panel (copy an existing one), wire it
   into the toolbar/editor.
7. **Verify** — `pytest`, `npm run build`, and a browser smoke test.

For AI/model features, read **`codex.txt`** at the repo root: it specifies the
inference runtime, GPU scheduler, graceful-degradation and tiling rules, and the
exact integration points for the remaining model-driven work.

## AI models & the registry

All optional models are declared in `backend/app/models_registry.py` — one
`ModelSpec` each with an **HTTPS-only, allowlisted** source, filename, size,
licence and rough VRAM. Use the helpers rather than hardcoding anything:

```python
from app import models_registry as reg
spec = reg.get("birefnet_lite")
reg.model_path(spec)      # where it lives
reg.is_installed(spec)    # is it ready?
reg.is_safe_url(url)      # trusted-source check
```

Models install on demand via the Model Manager API / Settings UI and live in the
per-user data dir (never the repo). Heavy inference dependencies belong in a
separate `requirements-ai.txt`, imported lazily so the base app stays light. Full
catalog and storage locations: [MODELS.md](MODELS.md).

## CI & releases

`.github/workflows/ci.yml` runs the test suite on every push/PR and, on a `v*`
tag or manual dispatch, builds installers for Windows, macOS and Linux and
publishes a GitHub Release with every installer attached. Code-signing and the
release process are documented in [RELEASE.md](RELEASE.md).

## Conventions

- **Non-destructive, parameters-not-pixels, one pipeline** — never bypass
  `render` or mutate the original.
- **Natural over exaggerated** — halo-free, no plastic skin or oversharpening.
- **Honest about hardware** — announce CPU vs GPU; degrade gracefully when a
  model is absent.
- **User-facing copy is product-grade** — describe capabilities by name; never
  surface internal "phase" numbers in the UI or product docs.
- **Match the surrounding code** — read a neighbouring module/panel first and
  follow its style.
