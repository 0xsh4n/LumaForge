# LumaForge

**AI-powered photo enhancement & DSLR conversion studio — local, offline, cross-platform.**

LumaForge turns ordinary smartphone photographs into professionally processed,
DSLR-style images using local AI models and classical image processing. It runs
entirely on your machine after installation — no cloud services, no subscriptions.

It is a **native desktop application**: a compiled [Tauri 2](https://tauri.app)
shell (Rust) that renders its UI in the OS webview (WebView2 on Windows) and
launches a bundled Python image-processing engine as a local sidecar.

> **Status — Phases 1, 2, 2b, 2c & 3 complete.** Implemented and tested:
> the non-destructive manual editing engine, **AI Auto Enhance**, the
> **Color Grading Studio** (curves/HSL/colour wheels/split-tone/`.cube` LUTs),
> the **RAW/DNG development engine** (LibRaw), and the identity-preserving
> **Portrait Studio** (face detection + 10 retouch modes). Masking, DSLR Look,
> depth/motion, upscaling and the local AI assistant come next — see
> [docs/ROADMAP.md](docs/ROADMAP.md).

---

## What works today

- **AI Auto Enhance** — adaptive, per-image analysis produces an *editable*
  enhancement profile (Natural / Professional / Cinematic + strength). Every value
  lands in the sliders; non-destructive, one-undo-step.
- **Color Grading Studio** — interactive tone curves (RGB + per-channel), 8-band
  HSL, 3-way colour-balance wheels, split toning, and `.cube` LUT import + export
  (bake your look to a LUT).
- **RAW / DNG development** — a real LibRaw pipeline (demosaic, camera WB,
  highlight handling, 16-bit) with live re-decode controls; the RAW file is never
  modified.
- **Portrait Studio** — YuNet face detection → skin/eye/teeth/hair masks →
  identity-preserving retouch (texture-preserving smoothing, eye/teeth/hair work,
  facial & background tone) across 10 editable modes. No geometry change.
- **Universal import** — JPEG, PNG, WebP, BMP, TIFF, plus HEIC/HEIF and camera
  RAW (DNG/CR2/CR3/NEF/ARW/…). Decoded to full-resolution float.
- **Manual editing engine** — real, parameter-driven adjustments:
  - *Light* — Exposure, Contrast, Highlights, Shadows, Whites, Blacks
  - *Color* — Temperature, Tint, Vibrance, Saturation, Hue
  - *Detail* — Sharpening (amount/radius/detail/masking), Texture, Clarity, Dehaze, Noise reduction
  - *Effects* — Vignette, Grain
- **Non-destructive pipeline** — the original is never modified; every edit is a
  parameter re-applied on demand. Preview-resolution rendering keeps sliders
  responsive; export always uses full resolution.
- **Live preview** with zoom/pan, hold-to-see-original, split and side-by-side
  comparison, undo/redo history, per-slider and global reset.
- **Image analysis** — histogram, clipping, exposure, color-cast and sharpness
  (the foundation the AI Auto Enhance will build on).
- **High-quality export** — JPEG, PNG, WebP and 16-bit TIFF, with quality,
  optional resize, sRGB profile embedding and metadata preservation.
- **Presets** — transparent, fully-editable starter looks.
- **Settings** — real hardware/GPU compatibility report, preview-quality control.

See screenshots and the full feature spec in [docs/](docs/).

## Architecture at a glance

```
┌─────────────────────────────────────────────┐
│  LumaForge.exe   (Tauri 2 / Rust native shell)│
│  ┌─────────────────────────────────────────┐ │
│  │ WebView2 UI  — React + TypeScript        │ │   UI thread
│  │ Tailwind · Zustand                       │ │
│  └───────────────────┬─────────────────────┘ │
│                      │ HTTP (127.0.0.1:8756)  │
│  ┌───────────────────▼─────────────────────┐ │
│  │ lumaforge-backend  (bundled sidecar .exe)│ │   processing
│  │ FastAPI · NumPy · OpenCV · Pillow        │ │   (CPU; GPU for
│  │ (+ PyTorch / ONNX Runtime in later phases)│ │    AI, later)
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Layer      | Technology |
|------------|-----------|
| Shell      | Tauri 2 (Rust), WebView2/WebKit |
| Frontend   | React 18, TypeScript, Tailwind CSS, Zustand |
| Backend    | Python, FastAPI, NumPy, OpenCV, Pillow |
| AI (later) | PyTorch, ONNX Runtime, Real-ESRGAN, GFPGAN/CodeFormer, BiRefNet, MediaPipe, Depth Anything V2 |

## Quick start (development)

Prerequisites: **Node 18+**, **Python 3.10–3.14**, **Rust** (for the native
shell), and the platform webview (WebView2 is preinstalled on Windows 10/11).

```bash
# 1. install everything (venv + backend deps + frontend deps)
./scripts/setup.sh            # Windows:  .\scripts\setup.ps1

# 2. run it
./scripts/dev.sh              # backend + browser UI at http://127.0.0.1:1420
./scripts/dev.sh --native     # backend + the native Tauri window
#   Windows:  .\scripts\dev.ps1            (native window)
#             .\scripts\dev.ps1 -Browser   (browser UI)
```

## Build the installable app

```bash
./scripts/build.sh            # Windows:  .\scripts\build.ps1
```

This freezes the Python backend into a sidecar executable and builds the native
bundle. On **Windows** you get an `.msi` and an NSIS `.exe` installer under
`desktop/src-tauri/target/release/bundle/`. On Linux you get `.deb`/AppImage; on
macOS a `.dmg`. Full instructions, including optional RAW/HEIC codecs and GPU
setup, are in [docs/INSTALL.md](docs/INSTALL.md).

## Testing

```bash
cd backend && ../.venv/bin/python -m pytest      # image-engine + API tests
cd desktop && npm run build                       # typecheck + frontend build
```

## Repository layout

```
LumaForge/
├── backend/            Python processing engine (FastAPI + image pipeline)
│   ├── app/
│   │   ├── imaging/    io · color · adjustments · pipeline · hardware
│   │   ├── routers/    system · images · process · projects
│   │   ├── store.py    in-memory non-destructive image sessions
│   │   └── main.py     FastAPI app + sidecar entry
│   ├── tests/
│   └── lumaforge-backend.spec   PyInstaller sidecar spec
├── desktop/            Tauri + React app
│   ├── src/            React UI (sections, editor, components, store, lib)
│   └── src-tauri/      Rust shell, tauri.conf.json, icons, capabilities
├── scripts/            setup · dev · build · build_sidecar  (.sh + .ps1)
├── docs/               ARCHITECTURE · INSTALL · GPU · ROADMAP
└── models/             downloaded AI model weights (runtime-managed)
```

## Principles

- **Natural results over exaggerated AI effects.** No fake HDR, oversharpening,
  plastic skin or unrealistic colors.
- **Non-destructive, always.** Originals are never overwritten.
- **Offline & private.** Everything runs locally once installed.
- **Honest about hardware.** The app never silently falls back to CPU — the
  compatibility report in Settings tells you exactly what is running where.

## License

See [LICENSE](LICENSE) (to be added by the project owner).
