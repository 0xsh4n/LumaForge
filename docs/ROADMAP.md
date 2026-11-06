<div align="center">

<img src="logo.svg" alt="Lumetta" width="260" />

# Roadmap

Where Lumetta is today and where it's heading. Development is incremental — each
capability ships tested and stable before the next begins, all behind the same
non-destructive pipeline.

</div>

---

## ✅ Available now

Everything here is implemented, tested, and works **fully offline with no AI
models required** (except Portrait Studio's small face detector, which downloads
automatically on first use).

- **Core editing engine** — non-destructive Light, Colour, Detail and Effects;
  live preview with zoom/pan, before/after compare, undo/redo, and per-control or
  global reset.
- **Universal import** — JPEG, PNG, WebP, BMP, TIFF, HEIC/HEIF and camera RAW,
  decoded to full-resolution float.
- **High-quality export** — JPEG, PNG, WebP and 16-bit TIFF with resize, sRGB
  profile and metadata options.
- **AI Auto Enhance** — adaptive, per-image analysis → an editable enhancement
  profile (Natural / Professional / Cinematic) with a strength dial.
- **AI Color Match** — scene-aware grading looks with skin-tone protection and an
  intensity control, applied by the deterministic colour engine.
- **Color Grading Studio** — tone curves (RGB + per-channel), 8-band HSL, 3-way
  colour-balance wheels, split toning, and `.cube` LUT import & export.
- **RAW / DNG development** — a real LibRaw pipeline (demosaic, camera WB,
  highlight handling, 16-bit) with live re-decode controls.
- **Portrait Studio** — face-aware, identity-preserving retouch across 10 modes;
  no geometry change, no generated faces.
- **Masks & local edits** — linear and radial gradient masks (and a brush model)
  with per-mask adjustments, selective blur, feather, invert, opacity and stacked
  layers.
- **Motion blur** — directional, zoom and spin effects.
- **Projects** — save and reopen your work as a tiny, non-destructive `.lfp` file.
- **Model manager** — browse, download and remove the optional AI models from
  trusted sources, with live progress and clear storage locations.

## 🛠 Coming soon

These build on the model manager that's already in place. They use optional
on-device models you install from **Settings → AI models**, and each degrades
gracefully when its model isn't present.

- **AI subject, background & sky masks** — high-quality automatic selections to
  drive local edits and separation.
- **Depth & bokeh workspace** — a monocular depth map powering natural,
  variable-strength background blur with aperture presets and a movable focus
  point; halo-free around hair and glass.
- **DSLR Look** — subject separation and lens-character rendering
  (35 / 50 / 85 / 135 mm) for a true camera feel.
- **AI upscaling & restoration** — 2×/4× enlargement and detail recovery with
  VRAM-aware tiled inference and an explicit CPU fallback.
- **Lumetta Assistant** *(optional, local)* — describe an edit in plain language
  and get **structured, reviewable adjustments** you approve before they apply.
  It never manipulates pixels directly, and the app works fully without it.

## 🎯 Design principles

- **Natural results** over exaggerated AI effects.
- **Non-destructive and editable** — AI produces parameters, masks and maps; the
  deterministic pipeline renders. Any language-model output is reviewable data,
  never direct pixel changes.
- **Optional and on-demand** — no model is required to edit; CPU fallback is
  always explicit, never silent.
- **Tuned for modest hardware** — designed to run well on a 4 GB GPU / 8 GB RAM
  baseline, and on the CPU everywhere else.

---

*Building from source or contributing? See the [Developer Guide](DEV_GUIDE.md).
Using the app? See the [User Guide](USER_GUIDE.md).*
