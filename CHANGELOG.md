# Changelog

All notable changes to LumaForge are documented here. Dates are ISO-8601.
Versioning will follow semver once 1.0 ships.

## [Unreleased]

### Added — Phase 1: Core editing engine
- Non-destructive manual editing engine (Light / Color / Detail / Effects) with
  real NumPy/OpenCV algorithms and a single render pipeline for preview + export.
- Universal import (JPEG, PNG, WebP, BMP, TIFF, HEIC/HEIF, camera RAW).
- Live preview with zoom/pan, before/after, split & side-by-side compare,
  undo/redo history, per-slider and global reset.
- Image analysis (histogram, clipping, exposure, color cast, sharpness).
- High-quality export: JPEG, PNG, WebP, 16-bit TIFF, with resize, sRGB profile
  and metadata options.
- Starter presets; Settings with a real hardware/GPU compatibility report.
- Tauri 2 native shell (Rust) launching the Python engine as a bundled sidecar.

### Added — Phase 2: AI Auto Enhance
- Adaptive, per-image analysis → editable enhancement profile with
  Natural / Professional / Cinematic modes and a strength slider. Non-destructive,
  committed as a single undo step.

### Added — Phase 2b: Color Grading Studio
- Interactive tone curves (RGB + per-channel), 8-band HSL mixer, 3-way
  color-balance wheels, split toning.
- `.cube` LUT import (3D/1D trilinear) with intensity, and LUT export that bakes
  the current color look into a 3D LUT.

### Added — Phase 2c: RAW / DNG development
- LibRaw (rawpy) develop pipeline: demosaic, camera WB, highlight handling,
  16-bit — with live re-decode controls (WB mode, exposure, highlight mode,
  demosaic algorithm, FBDD noise reduction). RAW files are never modified.
- Lens corrections: defringe (chromatic aberration) and barrel/pincushion
  distortion.

### Added — Phase 3: Portrait Studio
- OpenCV YuNet face detection (model auto-downloaded once) → skin/eyes/teeth/
  hair/face/background masks (skin-color segmentation refines skin).
- Identity-preserving classical retouch: texture-preserving skin smoothing,
  blemish reduction, eye enhance/brighten, teeth whitening, under-eye lift,
  facial exposure, face sharpening & noise reduction, hair enhancement,
  background exposure/saturation. No geometry change, no generative faces.
- 10 editable Portrait Studio modes + intensity & naturalness.

### Added — Model Manager & phases 4–7 groundwork
- Trusted AI-model catalog (`backend/app/models_registry.py`): every optional
  model for phases 4–7 (BiRefNet, MediaPipe Face Landmarker, SAM 2, Depth
  Anything V2, Real-ESRGAN, GFPGAN, CodeFormer, optional VLMs) with official,
  HTTPS-only sources, sizes, licenses and on-disk file names. A host allowlist
  rejects any non-trusted or plain-HTTP URL.
- Model Manager API (`/api/models`): list with install status, storage location
  and disk usage; download with live progress, atomic writes and optional
  checksum verification; remove. VLM and large/drifting assets are guided to
  manual install instead of firing a possibly-dead link.
- **Settings → AI models**: live manager UI — per-phase grouping, size/license/
  VRAM, download/remove, progress bars, and the exact storage folder. Home now
  reflects shipped phases 2–3 and links to the manager.
- YuNet face detection refactored onto the shared registry (no more duplicated
  URL/path constants).
- New docs: [docs/MODELS.md](docs/MODELS.md) — download links from safe sources
  and where models are stored; README and INSTALL updated accordingly.

### Added — Phase 8: Packaging & release
- Cross-platform CI (`.github/workflows/ci.yml`): tests on every push/PR; builds
  Windows (.msi + NSIS), macOS (.dmg) and Linux (.deb + AppImage) installers on
  tags and manual dispatch.
- PyInstaller sidecar spec validated end-to-end on Linux (single ~116 MB
  executable bundling OpenCV, NumPy, rawpy/LibRaw and FastAPI).
- Release documentation (`docs/RELEASE.md`).

### Notes
- Native installers must be built on their target OS (CI does this). The Linux
  dev machine used for development cannot compile the Tauri shell (no WebKitGTK).
