# LumaForge Roadmap

Development is incremental: each phase ships a tested, stable increment before
the next begins. Phase 1 (the core editing engine) is complete; everything after
builds on it behind the same non-destructive pipeline interface.

The sections in **( )** reference the product specification, including the
extended requirements (§18–§27).

---

## ✅ Phase 1 — Core editing engine *(complete)*

Project architecture, native shell, image import, live preview, the full manual
adjustment engine (Light/Color/Detail/Effects), non-destructive pipeline,
comparison, presets, settings/compatibility report, and high-quality export.
*(Spec §1–§3, §8, §11, §13–§15.)*

---

## ✅ Phase 2 — Auto Enhance & analysis *(complete)*

- Adaptive per-image analysis → enhancement profile (Natural / Professional /
  Cinematic) with a strength slider; every value lands in the sliders and
  remains manually editable. One-undo-step, non-destructive. *(§4)*
- Adaptive exposure, white-balance, black/white points, highlight/shadow
  recovery, contrast, vibrance, dehaze and noise-aware sharpening derived from
  robust scene statistics. Returns editable `Adjustments` + a plain-language
  summary of what it did. *(§4, §9)*
- `POST /api/images/{id}/auto-enhance`; 11 dedicated tests.

## ✅ Phase 2b — Color Grading Studio *(complete)*  *(§22)*

- RGB + per-channel **curves** (interactive editor), **HSL** (8 colour bands ×
  H/S/L), 3-way **colour-balance wheels** (shadows/midtones/highlights/global),
  **split toning**.
- **`.cube` LUT** import, 3D/1D trilinear application with intensity, and **LUT
  export** that bakes the current colour look (round-trip verified). Live preview
  on every control; 11 dedicated tests.
- Selective color is covered by the HSL mixer; film-emulation presets ship as
  importable LUTs.

## ✅ Phase 2c — RAW / DNG development engine *(complete)*  *(§21)*

- Proper LibRaw (rawpy) pipeline: decode sensor data → demosaic → white balance →
  camera colour → exposure/highlight handling → noise reduction → 16-bit sRGB —
  **not** embedded-JPEG extraction. Verified against a real Nikon NEF.
- RAW develop controls: WB mode (camera/auto/daylight), RAW exposure (EV),
  highlight mode (clip/blend/recover), demosaic algorithm (AHD/VNG/DCB/AAHD/LMMSE),
  FBDD noise reduction — all re-decode live and replace the working original,
  non-destructively (the RAW file is never touched).
- General **lens corrections** in the pipeline: defringe (CA) and
  barrel/pincushion distortion. Fine tonal/colour/black-white work uses the normal
  sliders on top. Export to 16-bit TIFF / JPEG / PNG / WebP.
- Remaining for a later pass: per-channel CA magnification tuning, lens-profile
  database, embedded ICC round-trip for RAW.

## ✅ Phase 3 — Portrait retouching & Portrait Studio *(complete)*

- Face detection via OpenCV **YuNet** (bundled, ~230 KB model auto-downloaded
  once) → feathered region masks for skin, eyes, teeth, hair, face and
  background (skin-colour segmentation refines skin). *(§5, §18)*
- Classical, **identity-preserving** retouch within those masks: frequency-
  separation skin smoothing with texture preservation, blemish reduction, eye
  enhance/brighten, teeth whitening, under-eye lift, facial exposure, face
  sharpening & noise reduction, hair enhancement, background exposure/saturation.
  No geometry change, no generative face synthesis.
- **Portrait Studio** with 10 editable mode profiles (Natural, Professional,
  Studio, Cinematic, Editorial, Beauty, Environmental, Corporate Headshot,
  Outdoor, Night) + intensity & naturalness. Verified on a real face photo;
  7 dedicated tests.
- Deferred to a later pass (optional, generative): face restoration
  (GFPGAN/CodeFormer) and 468-point landmarks — gated behind model verification.

> **Groundwork for phases 4–7 (done):** the optional AI models these phases rely
> on are now cataloged from trusted sources and installable on demand via the
> **Model Manager** (Settings → AI models) — see the Phase 7 §25 note below and
> [MODELS.md](MODELS.md). Each phase below still needs its own model inference +
> rendering built on top.

## Phase 4 — Masking engine *(models)*  *(§7)*

- AI Subject / Background / Sky masks (**BiRefNet**), Face/Skin masks, Brush,
  Linear & Radial gradient masks.
- Per-mask adjustments, feather, edge refine, invert, opacity, overlay preview,
  stacked & independently editable masks. Optional **SAM 2** for advanced
  segmentation.
- ✅ **Shipped (classical):** the masking engine core — **Linear & Radial
  gradient** masks and a **brush** model, each with per-mask local adjustments
  (exposure/contrast/tone, temperature/tint, saturation/vibrance, clarity,
  sharpness, **selective blur**), feather, invert, opacity, and stacked editable
  layers. Masks are parameters (not baked pixels) rendered by the same pipeline;
  `backend/app/imaging/masks.py` + Settings/editor UI. *Remaining:* AI
  subject/sky masks (BiRefNet/SAM, needs models) and on-canvas brush painting.

## Phase 5 — DSLR Look, Depth & Motion *(models + classical)*

- **DSLR Look** profiles (Natural / Portrait / Professional): subject separation,
  natural background blur, lens-character rendering (35/50/85/135 mm). *(§6)*
- **Depth & Bokeh** workspace (**Depth Anything V2 Small**) combined with
  segmentation + edge refinement: focus point/distance, bokeh shape/intensity,
  blur transition, hair-boundary refinement, inspectable/correctable depth map,
  aperture presets (f/1.4–f/8). Halo-free around hair/glass. *(§19)*
- **Motion & Lens Effects**: directional/radial/zoom/rotational motion blur,
  selectively applied (whole image / background / foreground / subject / painted
  regions) via convolution kernels + masked blur — non-destructive; AI motion is
  optional.
- ✅ **Shipped (classical):** whole-frame **motion blur** — directional (line
  kernel), **zoom** and **spin** — in `backend/app/imaging/motion.py`, with UI in
  the editor's Motion Blur panel. Selective motion is covered by a mask's
  **selective blur** local adjustment (Phase 4). *Remaining:* Depth Anything V2
  depth map → bokeh workspace and model-driven DSLR subject separation. *(§20)*

## Phase 6 — Upscaling, restoration & GPU scheduler *(models)*

- **Real-ESRGAN** 2×/4× upscaling, detail restoration, RAW/mobile denoise. *(§10)*
- **GPU resource scheduler** targeting 4 GB VRAM: on-demand load/unload, serial
  high-memory queue, tiled inference, CPU fallback with explicit notice,
  low-memory mode, live usage display, cancellable task queue. *(§12, §26)*

## Phase 7 — AI Color Match & Luma Assistant *(VLM infra)*

- **AI Color Match** button: analyze dominant/skin/environment colors, lighting,
  scene, mood → several adjustable grading recommendation **cards** (Apply /
  Compare / Save as preset / Intensity / Reset). Parameters applied by the
  deterministic color engine; skin tones protected. *(§23)*
- **Luma Assistant** (optional, local): natural-language requests → **structured
  JSON** adjustment parameters the user approves before applying. Never
  manipulates pixels directly. *(§24, §27)*
- **Model Manager** (§25): image models (Real-ESRGAN, CodeFormer, GFPGAN,
  BiRefNet, Depth Anything V2, MediaPipe) + optional VLMs via **llama.cpp /
  Ollama / ONNX** (Moondream 2, SmolVLM 500M, Gemma 3 4B, Qwen2.5-VL 3B).
  Download/install/remove, status/size/compatibility, runtime & GPU-layer
  selection. Everything works with **no VLM installed**.
  - ✅ **Foundation shipped:** a trusted model catalog
    (`backend/app/models_registry.py`) with official, HTTPS-only sources; a
    Model Manager API (`/api/models` list/status/storage, download with live
    progress + checksum, remove); and **Settings → AI models** in the UI
    (download/remove, per-phase grouping, storage path & disk usage). Documented
    in [MODELS.md](MODELS.md). This unblocks the model-dependent work in phases
    4–6; what remains per phase is the inference + rendering for each feature.

## ✅ Phase 8 — Packaging, cross-platform & release *(pipeline complete)*

- **Cross-platform CI** (`.github/workflows/ci.yml`): test job on every push/PR;
  installer builds on `windows-latest` (`.msi` + NSIS), `macos-latest` (`.dmg`)
  and `ubuntu-latest` (`.deb` + AppImage) on tags / manual dispatch, attached to
  a GitHub Release. *(Spec §16 Phase 7.)*
- **Sidecar packaging validated end-to-end** on Linux: PyInstaller produces a
  single ~116 MB executable bundling OpenCV + NumPy + rawpy/LibRaw + FastAPI that
  serves every endpoint and processes images. Placed where Tauri expects it;
  Cargo manifest resolves.
- Release & signing guide in [RELEASE.md](RELEASE.md).
- Remaining before a public 1.0: run the CI on the three OSes to emit signed
  installers (code-signing secrets), and smoke-test the packaged app on a Windows
  GTX 1650 machine.

---

### Design rules carried through every phase

- Natural results over exaggerated AI effects. *(§15, §27)*
- Non-destructive and editable — AI produces **parameters/masks/depth**, the
  deterministic pipeline renders. LLM/VLM output is JSON only.
- Models optional and on-demand; CPU fallback is explicit, never silent.
- Tuned for GTX 1650 / 4 GB VRAM / 8 GB RAM.
