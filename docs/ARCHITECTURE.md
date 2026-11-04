# LumaForge Architecture

LumaForge is split into three layers that communicate over a local HTTP boundary.
This keeps the UI responsive and the image math in a language with first-class
scientific/AI tooling, while still shipping as a single native application.

## 1. Native shell — Tauri 2 (Rust)

`desktop/src-tauri/` is a Tauri 2 application. It:

- opens the main window and renders the UI in the platform webview
  (WebView2 on Windows, WebKitGTK on Linux, WKWebView on macOS);
- launches the Python backend as a **sidecar** process on startup
  (`src/lib.rs` → `start_backend`), passing `--host 127.0.0.1 --port 8756`;
- terminates the sidecar when the app exits (`RunEvent::ExitRequested`);
- provides native file open/save dialogs via `tauri-plugin-dialog`.

Why a sidecar instead of embedding Python? It keeps the heavy, GPU-capable image
engine in a normal Python process (easy to develop, test and extend with
PyTorch/ONNX) while the shell stays a small native binary. The two are bundled
together into one installer, so to the user it is a single app.

In **development** the sidecar binary does not exist; `start_backend` logs and
returns, and the dev script runs the backend with `uvicorn` instead. The
frontend connects to `127.0.0.1:8756` either way.

## 2. Frontend — React + TypeScript

`desktop/src/`:

- **`store/editorStore.ts`** — a single Zustand store holding the open image,
  the `Adjustments` parameters, undo/redo history, preview/comparison state and
  all actions. The render loop lives here: slider changes are debounced, a
  preview is requested from the backend, stale responses are dropped
  (request-sequence guard + `AbortController`), and object URLs are revoked to
  avoid leaks.
- **`sections/`** — the five primary views: Home, Editor, AI Enhance, Presets,
  Settings.
- **`editor/`** — the editor's panes: left toolbar, center preview canvas
  (zoom/pan/compare), right adjustment panel, bottom action bar + export.
- **`lib/`** — `api.ts` (typed backend client), `platform.ts` (Tauri-vs-browser
  file dialogs and download fallback), `adjustments.ts` (neutral defaults +
  slider specs), `presets.ts`.

The frontend holds **no image-processing logic**. It sends parameters and
displays returned pixels, so preview and export are guaranteed identical.

## 3. Backend — Python + FastAPI

`backend/app/`:

- **`imaging/io.py`** — decode/encode/save; format + EXIF handling; optional
  HEIC (pillow-heif) and RAW (rawpy) codecs detected at runtime.
- **`imaging/color.py`** — sRGB↔linear (LUT-accelerated) and luminance helpers.
- **`imaging/adjustments.py`** — the real adjustment algorithms (white balance,
  exposure, tone, color, local contrast, sharpening, noise reduction, effects).
- **`imaging/pipeline.py`** — orders the adjustments into one pure `render()`
  function, plus `analyze()` for histogram/statistics.
- **`imaging/hardware.py`** — GPU/CUDA/VRAM detection and the Settings
  compatibility report.
- **`store.py`** — in-memory sessions holding each image's untouched
  full-resolution original plus a cached preview copy, with LRU eviction.
- **`routers/`** — `system` (health/hardware), `images` (import/meta/analyze),
  `process` (render/export), `projects` (save/open/recent).

### The non-destructive pipeline

```
original (float32 RGB, full-res, immutable)
   │
   ├─ preview request ─▶ downscale ─▶ render(adjustments, px_scale<1) ─▶ JPEG ─▶ UI
   │
   └─ export  request ─▶            render(adjustments, px_scale=1 ) ─▶ file
```

`render()` never mutates its input, so previews and exports can run concurrently
from the same original. `px_scale` (this render's long edge ÷ the original's)
keeps pixel-defined effects — sharpen radius, noise reduction — consistent
between a downscaled preview and a full-resolution export. Resolution-relative
effects (local contrast, vignette) derive their radii from the image's own size
and need no scaling.

### Processing order

White balance → exposure *(linear light)* → contrast → highlights/shadows/
whites/blacks → texture/clarity/dehaze → vibrance/saturation/hue → noise
reduction → sharpening → vignette → grain. This mirrors a photographer's mental
model and avoids compounding artifacts.

### Performance notes

- sRGB⇄linear conversions use an 8192-entry lookup table (the exact transfer
  function is too slow per-pixel at 12 MP).
- White balance and exposure share one linear round-trip.
- Large-radius blurs (clarity/dehaze) are computed on a downscaled copy.
- The vignette falloff map is cached per image size.
- Heavy work runs in a thread pool (`run_in_threadpool`) so the event loop stays
  free for health checks and concurrent requests.

## Project files

A `.lfp` project stores the schema version, a reference to the original image and
the full `Adjustments` — never pixels. Originals are therefore never rewritten
and projects stay tiny and portable.

## Where AI fits (later phases)

Each AI feature is added **behind the same pipeline interface**: a model produces
a mask, a depth map, or a set of adjustment parameters, which the deterministic
pipeline then applies. Models are loaded on demand and unloaded after use by a
GPU resource scheduler that respects the 4 GB-VRAM target (see
[ROADMAP.md](ROADMAP.md) and [GPU.md](GPU.md)). The LLM/VLM assistant only ever
returns structured JSON parameters — it never touches pixels directly.
