<div align="center">

<img src="logo.svg" alt="Lumetta" width="260" />

# User Guide

Everything you need to get beautiful results from your photos — locally and offline.

</div>

---

## Contents

- [Getting started](#getting-started)
- [The workspace](#the-workspace)
- [Importing photos](#importing-photos)
- [The editing workflow](#the-editing-workflow)
- [Manual adjustments](#manual-adjustments)
- [AI Auto Enhance](#ai-auto-enhance)
- [AI Color Match](#ai-color-match)
- [Depth & Bokeh](#depth--bokeh)
- [Lumetta Assistant](#lumetta-assistant)
- [AI upscaling](#ai-upscaling)
- [Portrait Studio](#portrait-studio)
- [Color grading](#color-grading)
- [RAW development](#raw-development)
- [Masks & local edits](#masks--local-edits)
- [Motion blur](#motion-blur)
- [Comparing & preview quality](#comparing--preview-quality)
- [Exporting](#exporting)
- [Projects](#projects)
- [AI models](#ai-models)
- [Settings](#settings)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Tips & FAQ](#tips--faq)

---

## Getting started

Download the installer for your platform, run it, and launch **Lumetta**.
Everything needed — including the image-processing engine — is bundled, so there
is nothing else to install. On Windows 10/11 the required webview is already
present; if it isn't, the installer fetches it automatically.

When the app opens you'll land on the **Home** screen. The small dot near the
action buttons shows the processing engine status — **Engine online** means
you're ready to edit.

## The workspace

A slim rail on the left switches between the main areas:

| | Area | What it's for |
|---|------|---------------|
| 🏠 | **Home** | Import a photo, open a saved project, and see what the studio can do. |
| 🎚️ | **Editor** | The main editing surface — the photo, tools and all adjustment panels. |
| ✦ | **AI** | A one-page overview of the AI features and live analysis of the current photo. |
| ▦ | **Presets** | Ready-made, fully editable starting looks. |
| ⚙️ | **Settings** | Hardware report, preview quality, and AI model management. |

Inside the **Editor** you'll find:

- the **photo canvas** in the centre, with zoom and pan;
- a **left toolbar** of AI tools and masks;
- a **right panel** with the Basic adjustments, Color Studio and histogram;
- a **bottom bar** with history, compare modes, zoom and export.

## Importing photos

Click **Import a photograph** on Home (or **Import** in the editor toolbar) and
choose a file. Lumetta opens:

- **Standard images** — JPEG, PNG, WebP, BMP, TIFF
- **High-efficiency** — HEIC / HEIF
- **Camera RAW** — DNG, CR2, CR3, NEF, ARW, RAF, RW2, ORF, PEF, SRW and more

Every image is decoded to full-resolution, high-precision colour so edits stay
clean. Your original file on disk is **never modified**.

## The editing workflow

Lumetta is **non-destructive**. Nothing you do changes the original — each
adjustment is a value that the engine re-applies on demand. That means you can:

- **Undo / redo** any step, in any order;
- **Reset** a single control (double-click its name) or everything at once;
- **Hold to compare** against the untouched original at any time;
- come back later and change a decision you made an hour ago.

While you drag a slider the preview updates live at a responsive resolution;
**exports always use the full resolution** regardless of the preview setting.

## Manual adjustments

The right-hand **Basic** panel holds the core controls, grouped like a
photographer would expect:

**Light** — Exposure, Contrast, Highlights, Shadows, Whites, Blacks.
Shape overall brightness and the tonal range. Highlights/Shadows recover detail
at the extremes; Whites/Blacks set the end points.

**Color** — Temperature, Tint, Vibrance, Saturation, Hue.
Temperature/Tint fix or style the white balance. Vibrance lifts muted colours
while protecting already-saturated ones and skin; Saturation moves everything.

**Detail** — Sharpening (Amount, Radius, Detail, Masking), Texture, Clarity,
Dehaze, Noise reduction. Sharpening is edge-aware to avoid halos; Masking keeps
smooth areas (skies, skin) untouched. Clarity adds mid-tone punch; Dehaze cuts
atmospheric haze; Noise reduction smooths grain before sharpening.

**Effects** — Vignette, Grain, plus lens corrections (Defringe, Distortion).

> Double-click any slider's label or value to reset just that control.

## AI Auto Enhance

Open **AI Auto Enhance** from the editor's AI tools. Lumetta analyses the photo —
exposure, white balance, contrast, dynamic range and noise — and produces an
**editable enhancement profile** in one of three looks:

- **Natural** — faithful, gentle correction.
- **Professional** — crisper contrast and presence.
- **Cinematic** — cooler, moodier, filmic.

A **Strength** slider blends the result toward neutral. Everything it chooses
lands in the normal sliders, so you can fine-tune any value afterwards. Applying
it is a single undo step.

## AI Color Match

Open **AI Color Match** to get several adjustable **grading looks** tailored to
your photo — for example *Natural Balance*, *Warm Cinematic*, *Cool Editorial*,
*Vibrant Pop*, *Golden Warmth* and *Mono Contrast*. Lumetta reads the image's
colour, light, mood and whether it contains skin, then adapts each look to suit.

- Click a card to preview it instantly on your photo.
- Use **Intensity** to dial the look up or down.
- **Skin tones are protected** — saturation and warmth are tempered when faces
  are present, so portraits never look garish.
- **Apply** commits the look (as one undo step) or **Discard** to cancel.

Color Match works entirely offline with no model required.

## Depth & Bokeh

Open **Depth & Bokeh** from the editor's AI tools. Lumetta estimates relative
depth, then applies an editable blur through the shared render pipeline. Choose
an aperture preset and adjust focus distance, transition, subject protection,
and highlight bloom. Install **Depth Anything V2 (Small)** from **Settings → AI
models** to enable depth estimation. CPU inference is supported and reported.

## Lumetta Assistant

Describe a common edit such as “brighter and warmer with teal shadows.” The local
rules assistant prepares an adjustment proposal while preserving your existing
edits. Review its summary, then choose **Apply** or **Discard**. The proposal is
data only; it never edits image pixels directly.

## AI upscaling

Choose **Upscale image** in the editor's AI tools, select 2× or 4×, and start
the job. Progress, CPU/GPU provider, and cancellation appear in the bottom bar.
When it completes, Lumetta replaces the working source with the larger image and
keeps your adjustment parameters. Install **Real-ESRGAN x4plus** in Settings.

## Portrait Studio

Open **AI Portrait Retouch**. Lumetta detects faces and builds feathered masks
for skin, eyes, teeth, hair, the face and the background, then applies
**identity-preserving** retouch — it only adjusts tone, colour and detail inside
those regions. It never changes facial geometry and never generates a face.

Pick one of **10 modes** (Natural, Professional, Studio, Cinematic, Editorial,
Beauty, Environmental, Corporate Headshot, Outdoor, Night) and refine with
controls for skin smoothing & texture, blemishes, eye and teeth work, facial and
background lighting, and more — plus overall **Intensity** and **Naturalness**.

> Portrait Studio needs the small face-detection model, which Lumetta downloads
> automatically the first time you use it. See [AI models](#ai-models).

## Color grading

Switch the right panel to **Color Studio** for a full grading stack:

- **Tone curves** — a master RGB curve plus per-channel Red/Green/Blue curves.
- **HSL** — eight colour bands, each with Hue / Saturation / Luminance.
- **Colour-balance wheels** — 3-way (shadows / midtones / highlights / global).
- **Split toning** — separate hues for shadows and highlights with balance.
- **LUTs** — import a `.cube` LUT and dial its intensity, or **export** your
  current look as a 3D LUT to reuse elsewhere.

## RAW development

When you open a RAW/DNG file, a **RAW Develop** panel appears. These controls
re-decode the sensor data itself:

- **White balance** — camera, auto or daylight;
- **Exposure** at the RAW stage (EV);
- **Highlight mode** — clip, blend or reconstruct;
- **Demosaic algorithm** — AHD / VNG / DCB / AAHD / LMMSE;
- **Noise reduction** (FBDD).

Changing them regenerates the working image; your normal adjustments then layer
on top. The RAW file on disk is never altered.

## Masks & local edits

Apply adjustments to only part of the photo. From the left toolbar, **Masks**:

- **Linear gradient** — a smooth selection along an angle (skies, foregrounds).
- **Radial gradient** — an elliptical selection (spotlight a subject).
- **Brush** — paint a selection directly on the canvas with adjustable size and hardness.

Each mask carries its own adjustments — exposure, contrast, tone, temperature,
tint, saturation, vibrance, clarity, sharpness and a **selective blur** — plus
**feather**, **invert**, **opacity**, and you can **stack** multiple masks and
edit each independently in the **Masks** panel.

> **Tip:** a radial mask with selective blur gives a quick, natural
> background-defocus look.

## Motion blur

In the **Basic** panel, open **Motion Blur** to add a creative, whole-frame
motion effect:

- **Directional** — a straight streak at an angle you choose.
- **Zoom** — a radial "dolly" streak from a centre point.
- **Spin** — a rotational streak around a centre point.

Set the **Amount** and, for zoom/spin, the **centre**. For motion on just part of
the frame, use a mask's selective blur instead.

## Comparing & preview quality

- **Before** (bottom bar, or hold `\`) shows the untouched original while pressed.
- **Split** and **Side-by-side** give a persistent before/after.
- **Zoom** with the controls or fit to screen.
- In **Settings → Preview quality**, choose Draft / Standard / High. Higher is
  sharper but slower while dragging sliders — exports are unaffected.

## Exporting

Click **Export** in the bottom bar:

- **Format** — JPEG, PNG, WebP or 16-bit TIFF.
- **Quality** — for JPEG/WebP.
- **Resize** — optionally cap the longest edge.
- sRGB profile embedding and metadata are preserved.

Exports always render at full resolution.

## Projects

Save your edit as a small **`.lfp` project** — it stores a reference to the
original plus your adjustments, never the pixels, so projects stay tiny and your
original is untouched.

- **Save** / **Open** project from the editor header.
- **Recent projects** appear on the Home screen for one-click reopening.

Opening a project re-imports the original and restores your full edit.

## AI models

Some advanced features use optional AI models. Manage them in
**Settings → AI models**:

- Models are grouped by purpose (face detection, masking, depth & bokeh,
  upscaling, restoration).
- Each shows its size, licence and rough memory needs.
- **Download** fetches it from the official source with a progress bar; **Remove**
  reclaims the disk space.
- The exact storage folder and total disk used are shown at the top.

Nothing here is required for manual editing, Auto Enhance, Color Match, color
grading or RAW. Full details and safe download links: [MODELS.md](MODELS.md).

## Settings

- **Hardware compatibility** — your OS, processor, libraries, and GPU/VRAM, plus
  whether a CUDA runtime is available. Lumetta is honest about what runs on the
  CPU vs the GPU.
- **Preview quality** — Draft / Standard / High.
- **AI models** — the model manager described above.
- **About** — app and engine version.

## Keyboard shortcuts

| Action | Shortcut |
|--------|----------|
| Undo | `Ctrl/Cmd + Z` |
| Redo | `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` |
| View original (hold) | `\` |
| Reset a single control | double-click its name/value |

## Tips & FAQ

**Does Lumetta send my photos anywhere?** No. All processing is local. Optional
AI models are downloaded once from their official sources; your images never leave
your machine.

**Will it change my original files?** Never. Editing is non-destructive and
exports are written as new files.

**Do I need a powerful GPU?** No. The entire manual engine, Auto Enhance, Color
Match, grading and RAW run on the CPU. A GPU only accelerates the optional AI
models — and Lumetta tells you when something runs on the CPU.

**My colours look muted after import.** RAW files open relatively flat by design;
use RAW Develop plus the normal sliders, or try **Auto Enhance** / **Color Match**
as a starting point.

**Where are my models stored?** See the path shown in **Settings → AI models**
(and [MODELS.md](MODELS.md)).
