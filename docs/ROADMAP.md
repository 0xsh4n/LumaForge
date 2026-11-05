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

## Phase 2b — Color Grading Studio *(classical, no models)*  *(§22)*

- RGB + per-channel **curves**, **HSL** (8 color bands × H/S/L), **color wheels**
  (shadows/midtones/highlights/global), **split toning**, **selective color**.
- **LUT** import/export (`.cube`), film-emulation presets, grain & vignette in a
  color-managed pipeline with live preview for every control.

## Phase 2c — RAW / DNG development engine *(classical; mandatory)*  *(§21)*

- Proper LibRaw (rawpy) pipeline: decode sensor data → demosaic → white balance →
  camera color → exposure/highlight/shadow → noise reduction → lens corrections →
  working color space — **not** embedded-JPEG extraction.
- RAW controls (exposure, temp/tint, highlight/shadow recovery, black/white
  levels, demosaic quality, CA & distortion correction, RAW NR, sharpening) in a
  ≥16-bit / floating-point pipeline. Originals preserved; parameters saved in
  `.lfp` projects. Camera/ICC profile handling. *(Depends on `rawpy`/LibRaw.)*

## Phase 3 — Portrait retouching & Portrait Studio *(models)*

- Face/landmark detection (**MediaPipe**), skin/eyes/lips/hair regions. *(§5, §18)*
- Blemish reduction, texture-preserving skin smoothing, eye/teeth refinement,
  face-specific exposure & sharpening, hair enhancement — identity and facial
  geometry always preserved.
- Face restoration (**GFPGAN / CodeFormer**).
- **Portrait Studio** workspace with editable mode profiles (Natural,
  Professional, Studio, Cinematic, Editorial, Beauty, Environmental, Corporate
  Headshot, Outdoor, Night) + intensity & naturalness sliders.

## Phase 4 — Masking engine *(models)*  *(§7)*

- AI Subject / Background / Sky masks (**BiRefNet**), Face/Skin masks, Brush,
  Linear & Radial gradient masks.
- Per-mask adjustments, feather, edge refine, invert, opacity, overlay preview,
  stacked & independently editable masks. Optional **SAM 2** for advanced
  segmentation.

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
  optional. *(§20)*

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

## Phase 8 — Packaging, cross-platform & release

Windows installer (`.msi` / NSIS), Linux (`.deb`/AppImage), macOS (`.dmg`),
full test suite, user & developer documentation. *(Spec §16 Phase 7.)*

---

### Design rules carried through every phase

- Natural results over exaggerated AI effects. *(§15, §27)*
- Non-destructive and editable — AI produces **parameters/masks/depth**, the
  deterministic pipeline renders. LLM/VLM output is JSON only.
- Models optional and on-demand; CPU fallback is explicit, never silent.
- Tuned for GTX 1650 / 4 GB VRAM / 8 GB RAM.
