# GPU & Performance

**Target hardware:** an NVIDIA GTX 1650 (≈4 GB VRAM) laptop, 8 GB RAM,
Windows 10/11. Lumetta is tuned not to require anything more.

## Today: CPU processing

All manual adjustments, analysis and export run on the **CPU** using
NumPy and OpenCV (OpenCV uses all cores for blurs/resampling). There is no GPU
requirement yet. The Settings → *Hardware compatibility* panel states this
plainly — Lumetta never implies GPU work that isn't happening.

Responsiveness is maintained by:

- rendering interactive previews at a reduced resolution (Preview Quality in
  Settings: Draft 1024 px / Standard 1400 px / High 1920 px),
- a debounced, stale-dropping render loop,
- full resolution used only on export.

## Optional AI: GPU acceleration

AI features (upscaling, face restoration, segmentation, depth, color reasoning)
use the GPU through **ONNX Runtime (CUDA EP)** and/or **PyTorch** when available,
with CPU fallback. The compatibility report detects:

- NVIDIA GPU name, driver, and **live VRAM** (via `nvidia-smi`),
- whether a CUDA-capable runtime (torch / onnxruntime) is installed.

### GPU resource scheduler (planned — see the [Roadmap](ROADMAP.md))

Because 4 GB VRAM is small, a shared scheduler will:

- load models on demand and unload them after each job,
- never assume the full 4 GB is free — a reserve is held back for the display
  and other apps,
- prevent two high-memory inferences from running at once (a serial queue),
- use **tiled inference** for large images,
- expose a **low-memory mode** for laptops,
- fall back to CPU with an explicit notice rather than silently,
- let the user watch GPU/VRAM usage and cancel queued tasks.

For the local vision-language assistant (ROADMAP §24–25), GPU offload is
configurable (llama.cpp GPU layers / Ollama), and the whole assistant is
optional — every ordinary editing feature works with no model installed.

## Tuning tips

- Lower **Preview Quality** to Draft on slower machines for snappier sliders.
- Large exports (e.g. 40+ MP with heavy local-contrast/noise settings) are
  CPU-bound and can take several seconds; this is expected and shows progress.
- Keep other VRAM-hungry apps closed when running AI features on a 4 GB GPU.
