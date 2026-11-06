# Installing & Building LumaForge

## For end users (once a release is built)

Run the installer for your platform and launch LumaForge. Everything needed to
run — including the processing engine — is bundled. Windows 10/11 already include
WebView2; if it is missing, the installer fetches it automatically.

## For developers

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | frontend build & dev server |
| Python | 3.10–3.14 | backend engine |
| Rust | stable (1.77+) | native Tauri shell — install via [rustup](https://rustup.rs) |

Platform build dependencies for Tauri:

- **Windows** — [Microsoft C++ Build Tools] and WebView2 (preinstalled on Win 10/11).
- **Linux** — `webkit2gtk`, `libappindicator`, `librsvg`, `patchelf`
  (e.g. on Debian/Ubuntu: `libwebkit2gtk-4.1-dev build-essential curl wget file
  libssl-dev libayatana-appindicator3-dev librsvg2-dev`).
- **macOS** — Xcode command line tools.

See the Tauri prerequisites guide for the exact package list per distro.

### Setup

```bash
./scripts/setup.sh         # Windows:  .\scripts\setup.ps1
```

This creates `.venv/`, installs backend requirements, and runs `npm install`.

### Optional codecs

RAW and HEIC support are optional and detected at runtime (shown in Settings →
Hardware compatibility → Supported formats):

```bash
.venv/bin/python -m pip install rawpy pillow-heif
#   Windows:  .venv\Scripts\python -m pip install rawpy pillow-heif
```

If a wheel is unavailable for your Python version, the app still runs — just
without that format. (RAW development becomes a first-class pipeline in a later
phase; see ROADMAP.)

### Run

```bash
./scripts/dev.sh            # backend + browser UI (works on any OS)
./scripts/dev.sh --native   # backend + native window
#   Windows:  .\scripts\dev.ps1   /   .\scripts\dev.ps1 -Browser
```

### AI models (optional)

LumaForge works fully without any AI models — manual editing, Auto Enhance,
color grading and RAW development are all classical. The AI features in phases
4–7 (masking, depth & bokeh, upscaling, face restoration, the optional Luma
Assistant) use optional models downloaded on demand from their **official
sources**.

- **In the app:** open **Settings → AI models** to download, inspect and remove
  models. It shows the exact folder they are stored in and how much disk they use.
- **Storage location** (per-user data dir, *not* the repo):
  - Windows `%APPDATA%\LumaForge\models\`
  - macOS `~/Library/Application Support/LumaForge/models/`
  - Linux `~/.local/share/LumaForge/models/` (or `$LUMAFORGE_DATA_DIR/models/`)
- **Manual install & full link table:** see **[MODELS.md](MODELS.md)** — download
  from the official link and save it under the models folder with the exact file
  name listed there.

### Build the installable app

The backend is frozen into a platform-specific sidecar executable, then Tauri
bundles the native installer. **Build on the OS you are targeting.**

```bash
./scripts/build.sh          # Windows:  .\scripts\build.ps1
```

Outputs:

- **Windows** → `desktop/src-tauri/target/release/bundle/msi/*.msi` and
  `.../nsis/*-setup.exe`
- **Linux** → `.../bundle/deb/*.deb`, `.../bundle/appimage/*.AppImage`
- **macOS** → `.../bundle/dmg/*.dmg`

For automated cross-platform release builds (GitHub Actions) and code-signing
notes, see [RELEASE.md](RELEASE.md).

The sidecar step alone:

```bash
./scripts/build_sidecar.sh   # Windows:  .\scripts\build_sidecar.ps1
```

produces `desktop/src-tauri/binaries/lumaforge-backend-<target-triple>[.exe]`,
which Tauri picks up via `bundle.externalBin` in `tauri.conf.json`.

### Troubleshooting

- **"Processing engine not reachable"** in the app — the backend isn't running.
  In dev, make sure `scripts/dev.*` started it (port 8756). In a built app, check
  that the sidecar binary was produced for your target triple before `tauri build`.
- **Tauri `build` fails on a missing permission** — the exact permission string
  for the shell/sidecar can vary by Tauri patch version. `npm run tauri:dev`
  prints the precise identifier to add to
  `desktop/src-tauri/capabilities/default.json`.
- **Python 3.14** — all Phase-1 dependencies ship wheels for 3.14. Heavy AI
  packages (PyTorch, ONNX Runtime) used in later phases may lag; use Python
  3.11/3.12 if you need those before upstream wheels land.
