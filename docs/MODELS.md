# LumaForge AI Models

LumaForge runs fully offline. The manual editing engine, Auto Enhance, color
grading and RAW development are **classical** (NumPy/OpenCV/LibRaw) and need no
downloads. The AI-assisted features in phases 4–7 — masking, depth & bokeh,
upscaling, face restoration and the optional Luma Assistant — use the optional
models listed here. Every model is **optional**, fetched **on demand**, and comes
from its **official source**.

> The easiest way to install these is in the app: **Settings → AI models**. It
> downloads from the same official sources below, verifies the file, shows live
> progress, and lets you remove a model to reclaim disk space.

---

## Where models are stored

Models live in the **per-user data directory**, never inside the repository or
the installed program:

| Platform | Models directory |
|----------|------------------|
| **Windows** | `%APPDATA%\LumaForge\models\` |
| **macOS** | `~/Library/Application Support/LumaForge/models/` |
| **Linux** | `$XDG_DATA_HOME/LumaForge/models/` (default `~/.local/share/LumaForge/models/`) |

You can override the base location by setting the `LUMAFORGE_DATA_DIR`
environment variable before launching; models then go to
`$LUMAFORGE_DATA_DIR/models/`. The exact resolved path is always shown in
**Settings → AI models**.

To install a model **manually**, download it from its source below and drop it
into that folder using the **exact file name** given in the table. LumaForge
detects it on the next launch (or when you reopen Settings → AI models).

> The `models/` folder at the repository root is only a placeholder for
> development and is **not** where the running app looks.

---

## Trusted sources only

LumaForge will only auto-download over HTTPS from these hosts: the model
author's **GitHub releases**, their **Hugging Face** repository, the **OpenCV
Zoo**, and **Google's MediaPipe** model CDN. Anything else (or any plain-HTTP
link) is rejected. If you place files manually, only use the official links
below.

---

## Model catalog

Sizes are approximate. "VRAM" is a rough guide for GPU use; all image models
also run on CPU (slower). VLMs are installed through **Ollama** or **llama.cpp**,
not downloaded by LumaForge — and everything works with **no VLM installed**.

### Phase 4 — Masking engine

| Model | Powers | Size | License | File name | Download |
|---|---|---|---|---|---|
| **BiRefNet (general)** | Subject / Background / Sky masks (highest quality) | 928 MB | MIT | `BiRefNet-general.onnx` | [onnx-community/BiRefNet-ONNX](https://huggingface.co/onnx-community/BiRefNet-ONNX) |
| **BiRefNet lite** | Subject/background masks for 4 GB GPUs & CPU | 214 MB | MIT | `BiRefNet-lite.onnx` | [onnx-community/BiRefNet_lite-ONNX](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX) |
| **MediaPipe Face Landmarker** | 468-point face mesh for precise facial masks | 4 MB | Apache-2.0 | `face_landmarker.task` | [direct](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task) · [docs](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) |
| **SAM 2.1 Hiera Tiny** *(advanced, optional)* | Click/box prompt segmentation | 149 MB | Apache-2.0 | `sam2.1_hiera_tiny.pt` | [facebook/sam2.1-hiera-tiny](https://huggingface.co/facebook/sam2.1-hiera-tiny) |

### Phase 5 — DSLR Look, Depth & Motion

| Model | Powers | Size | License | File name | Download |
|---|---|---|---|---|---|
| **Depth Anything V2 (Small)** | Depth map for the Depth & Bokeh workspace | 99 MB | Apache-2.0 | `depth_anything_v2_small.safetensors` | [direct](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf/resolve/main/model.safetensors) · [card](https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf) |

*(Motion & Lens effects and classical DSLR background separation need no model.)*

### Phase 6 — Upscaling & restoration

| Model | Powers | Size | License | File name | Download |
|---|---|---|---|---|---|
| **Real-ESRGAN x4plus** | 4× upscaling + detail restoration | 67 MB | BSD-3-Clause | `RealESRGAN_x4plus.pth` | [direct](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth) · [repo](https://github.com/xinntao/Real-ESRGAN) |
| **Real-ESRGAN x2plus** | 2× upscaling + denoise | 67 MB | BSD-3-Clause | `RealESRGAN_x2plus.pth` | [direct](https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth) · [repo](https://github.com/xinntao/Real-ESRGAN) |

### Phase 7 — Restoration helpers & optional VLMs

| Model | Powers | Size | License | File name | Download |
|---|---|---|---|---|---|
| **GFPGAN v1.4** *(optional, generative)* | Face restoration | 333 MB | Apache-2.0 | `GFPGANv1.4.pth` | [direct](https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth) · [repo](https://github.com/TencentARC/GFPGAN) |
| **CodeFormer** *(optional, generative)* | Face restoration, identity-fidelity dial | 360 MB | NTU S-Lab 1.0 | `codeformer.pth` | [direct](https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/codeformer.pth) · [repo](https://github.com/sczhou/CodeFormer) |
| **Moondream 2** *(VLM, optional)* | AI Color Match & Luma Assistant | ~1.8 GB | Apache-2.0 | via Ollama | `ollama pull moondream` · [card](https://huggingface.co/vikhyatk/moondream2) |
| **SmolVLM 500M** *(VLM, optional)* | Low-memory assistant | ~1 GB | Apache-2.0 | via Ollama | [card](https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct) |

> **YuNet face detector** (`face_detection_yunet_2023mar.onnx`, <1 MB, MIT) powers
> Portrait Studio (Phase 3) and Face/Skin masks. LumaForge downloads it
> automatically the first time you use those features, from the
> [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet).

---

## Hardware notes

LumaForge targets a **GTX 1650 / 4 GB VRAM / 8 GB RAM** baseline. On such GPUs
prefer the **lite / small** variants (BiRefNet lite, Depth Anything V2 Small);
large models run via tiled inference or fall back to CPU with an explicit
notice. VLMs are the heaviest items and are entirely optional.

See also [GPU.md](GPU.md) for the compatibility report and execution-provider
details.
