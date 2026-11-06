<div align="center">

<img src="docs/logo.svg" alt="Lumetta" width="300" />

### AI photo enhancement & DSLR conversion studio — local, offline, cross-platform

Turn ordinary photographs into professionally processed, DSLR-style images using
local AI and classical image processing. Everything runs on your own machine —
no cloud, no accounts, no subscriptions.

[User Guide](docs/USER_GUIDE.md) · [Developer Guide](docs/DEV_GUIDE.md) ·
[AI Models](docs/MODELS.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md)

</div>

---

## Why Lumetta

- **Fully local & private.** After install, every pixel is processed on your
  machine. Your photos never leave your computer.
- **Non-destructive, always.** Your original is never modified. Each edit is a
  parameter re-applied on demand, so you can change or undo anything, anytime.
- **Natural results.** The engine favours realistic output over exaggerated AI —
  no plastic skin, fake HDR, or oversharpening.
- **Honest about hardware.** Lumetta never silently falls back to the CPU; the
  compatibility report tells you exactly what runs where.
- **No subscriptions.** It's a native desktop app, not a web service.

## What's inside

| | |
|---|---|
| **AI Auto Enhance** | One click reads the scene and balances exposure, white balance, contrast and dynamic range into an editable profile (Natural / Professional / Cinematic). |
| **AI Color Match** | Analyses colour, light and mood, then proposes adjustable cinematic grading looks with skin tones protected. |
| **Portrait Studio** | Identity-preserving retouch — skin, eyes, teeth, hair and lighting — inside face-aware masks across 10 modes. No geometry change, no generated faces. |
| **Color Grading** | Interactive tone curves (RGB + per-channel), 8-band HSL, 3-way colour-balance wheels, split toning, and `.cube` LUT import & export. |
| **RAW development** | A real LibRaw pipeline — demosaic, camera white balance, highlight handling, 16-bit — with live re-decode controls. The RAW file is never touched. |
| **Masks & local edits** | Linear, radial and brush masks with their own adjustments (tone, colour, clarity, selective blur), feather, invert, opacity and stacked layers. |
| **Motion blur** | Directional, zoom and spin motion effects, applied non-destructively. |
| **Precision editing** | Light, colour, detail and effects — real, parameter-driven controls with live preview. |
| **Universal import & export** | Open JPEG, PNG, WebP, BMP, TIFF, HEIC/HEIF and camera RAW; export full-resolution JPEG, PNG, WebP or 16-bit TIFF with sRGB profile and metadata. |
| **Projects** | Save your work as a tiny `.lfp` file (a reference to the original plus your edits) and reopen it anytime. |

> **In development:** additional DSLR lens looks.
> See the [Roadmap](docs/ROADMAP.md) for current capabilities.

## How it works

Lumetta is a native desktop application: a compiled [Tauri 2](https://tauri.app)
shell (Rust) renders the UI in the OS webview and launches a bundled Python
image-processing engine as a local sidecar. All image math lives in the Python
backend; AI produces **parameters, masks and maps** that a single deterministic
pipeline renders — never pixels directly.

```
┌──────────────────────────────────────────────────┐
│  Lumetta        (Tauri 2 / Rust native shell)      │
│  ┌──────────────────────────────────────────────┐ │
│  │ Webview UI — React + TypeScript · Tailwind    │ │  UI
│  └──────────────────────┬───────────────────────┘ │
│                         │ HTTP · 127.0.0.1         │
│  ┌──────────────────────▼───────────────────────┐ │
│  │ lumetta-backend  (bundled Python sidecar)     │ │  processing
│  │ FastAPI · NumPy · OpenCV · LibRaw · Pillow     │ │  (CPU; GPU for
│  │ (+ ONNX Runtime for optional AI models)        │ │   optional AI)
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

More detail in the [Architecture](docs/ARCHITECTURE.md) and [Developer Guide](docs/DEV_GUIDE.md).

## Install

Download the installer for your platform from the Releases page and launch it —
everything needed, including the processing engine, is bundled. See the
[User Guide](docs/USER_GUIDE.md) to get started, or [INSTALL.md](docs/INSTALL.md)
for building from source.

## Quick start (from source)

Prerequisites: **Node 18+**, **Python 3.10–3.14**, **Rust** (for the native
shell), and the platform webview (WebView2 is preinstalled on Windows 10/11).

```bash
./scripts/setup.sh            # Windows:  .\scripts\setup.ps1   — venv + deps + npm install
./scripts/dev.sh              # backend + browser UI at http://127.0.0.1:1420
./scripts/dev.sh --native     # backend + the native window
```

Build installers (on the OS you're targeting):

```bash
./scripts/build.sh            # Windows:  .\scripts\build.ps1
```

Full build, codec and packaging details are in the [Developer Guide](docs/DEV_GUIDE.md)
and [INSTALL.md](docs/INSTALL.md).

## AI models (optional)

Manual editing, Auto Enhance, Color Match, color grading and RAW development are
all classical and need no downloads. The optional AI features use models pulled
on demand from their **official sources** and managed in **Settings → AI models**.
They are stored in your per-user data directory — never in the repo. The full
catalog, safe download links and storage locations are in [MODELS.md](docs/MODELS.md).

## Documentation

| Doc | For |
|-----|-----|
| [User Guide](docs/USER_GUIDE.md) | Using every feature of the app |
| [Developer Guide](docs/DEV_GUIDE.md) | Architecture, setup, testing, building, contributing |
| [AI Models](docs/MODELS.md) | Optional models, safe sources, where they're stored |
| [Architecture](docs/ARCHITECTURE.md) | How the shell, engine and pipeline fit together |
| [GPU & hardware](docs/GPU.md) | Compatibility, acceleration, VRAM |
| [Release & signing](docs/RELEASE.md) | CI builds, installers, code signing |
| [Roadmap](docs/ROADMAP.md) | What's available now and what's next |

## License

See [LICENSE](LICENSE) (to be added by the project owner).
