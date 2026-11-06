"""Central registry of the optional AI models used by LumaForge.

Everything the app can download lives here, in one place, so the backend, the
Settings → Model Manager UI and the documentation all describe the *same* set of
files, from the *same* trusted sources.

Design rules
------------
* **Safe sources only.** Every download URL points at an official, well-known
  host (the model author's GitHub release, their Hugging Face repo, the OpenCV
  Zoo, or Google's MediaPipe CDN). :func:`is_safe_url` enforces this allowlist,
  and the test suite asserts it for every entry.
* **Optional & on-demand.** No model is required to run LumaForge. The manual
  editing engine, Auto Enhance, color grading and RAW development are fully
  classical and ship with the app. Models only unlock the AI-assisted features
  of phases 4–7, and are fetched (or removed) by the user when they want them.
* **One storage location.** Models are stored in the per-user data directory
  (``<data_dir>/models`` — see :mod:`app.config`), never inside the repo or the
  installed program. :func:`app.config.Settings.models_dir` is the single
  source of truth and is reported to the UI and the docs.
* **No dead-link surprises.** Where a stable direct URL exists we record it so
  the in-app downloader can fetch the file. Where the author only publishes
  behind a model card (and the exact asset path drifts between releases), we
  leave ``url`` empty and the UI guides the user to the source page to place the
  file manually — rather than firing a URL that might 404.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

from .config import get_settings

# Hosts we are willing to download from. A URL is accepted only if it is HTTPS
# and its host is, or is a subdomain of, one of these. (GitHub releases and
# Hugging Face `resolve` links redirect to their CDNs, which urllib follows
# automatically — we validate the initial, author-controlled host.)
SAFE_HOSTS: frozenset[str] = frozenset({
    "github.com",
    "githubusercontent.com",          # media./raw./objects. subdomains
    "huggingface.co",
    "hf.co",
    "storage.googleapis.com",         # Google MediaPipe model CDN
})


@dataclass(frozen=True)
class ModelSpec:
    """One downloadable model file and where it safely comes from."""

    id: str                 # stable key used by the API and on disk lookups
    name: str               # human label
    phase: int              # roadmap phase this model unlocks
    feature: str            # what it powers, in one line
    filename: str           # exact file name under models_dir
    source_page: str        # official, human-readable page (always safe)
    license: str            # upstream license (short form)
    size_mb: float          # approximate download size, for the UI
    url: str | None = None  # direct download; None ⇒ manual placement only
    sha256: str | None = None   # optional integrity check (verified if present)
    kind: str = "image"     # "image" (ONNX/torch weights) or "vlm"
    min_vram_mb: int = 0    # rough VRAM for GPU use; 0 ⇒ runs comfortably on CPU
    note: str = ""


# ---------------------------------------------------------------------------
# The registry. Ordered by phase, then by how central the model is.
# ---------------------------------------------------------------------------

_MODELS: tuple[ModelSpec, ...] = (
    # ---- Phase 3 (already used by Portrait Studio) -----------------------
    ModelSpec(
        id="yunet_face",
        name="YuNet face detection",
        phase=3,
        feature="Fast, tiny face detector behind Portrait Studio and Face/Skin masks.",
        filename="face_detection_yunet_2023mar.onnx",
        url=("https://media.githubusercontent.com/media/opencv/opencv_zoo/main/"
             "models/face_detection_yunet/face_detection_yunet_2023mar.onnx"),
        source_page="https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet",
        license="MIT",
        size_mb=0.23,
    ),

    # ---- Phase 4 — Masking engine ----------------------------------------
    ModelSpec(
        id="birefnet_general",
        name="BiRefNet (general)",
        phase=4,
        feature="High-resolution Subject / Background / Sky segmentation masks.",
        filename="BiRefNet-general.onnx",
        url=None,  # exact release asset path drifts; place manually from source page
        source_page="https://huggingface.co/onnx-community/BiRefNet-ONNX",
        license="MIT",
        size_mb=928.0,
        min_vram_mb=3500,
        note="Highest quality matting. Use the lite model on 4 GB GPUs or CPU.",
    ),
    ModelSpec(
        id="birefnet_lite",
        name="BiRefNet lite",
        phase=4,
        feature="Lighter subject/background segmentation for 4 GB GPUs and CPU.",
        filename="BiRefNet-lite.onnx",
        url=None,
        source_page="https://huggingface.co/onnx-community/BiRefNet_lite-ONNX",
        license="MIT",
        size_mb=214.0,
        min_vram_mb=1500,
    ),
    ModelSpec(
        id="mediapipe_face_landmarker",
        name="MediaPipe Face Landmarker",
        phase=4,
        feature="468-point face mesh for precise facial masks and landmarks.",
        filename="face_landmarker.task",
        url=("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
             "face_landmarker/float16/1/face_landmarker.task"),
        source_page="https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker",
        license="Apache-2.0",
        size_mb=3.8,
    ),
    ModelSpec(
        id="sam2_hiera_tiny",
        name="SAM 2.1 Hiera Tiny",
        phase=4,
        feature="Optional click/box prompt segmentation for advanced masking.",
        filename="sam2.1_hiera_tiny.pt",
        url=None,  # Meta publishes per-release; place manually from source page
        source_page="https://huggingface.co/facebook/sam2.1-hiera-tiny",
        license="Apache-2.0",
        size_mb=149.0,
        min_vram_mb=2500,
        note="Advanced/optional. BiRefNet covers automatic subject masks already.",
    ),

    # ---- Phase 5 — DSLR Look, Depth & Motion -----------------------------
    ModelSpec(
        id="depth_anything_v2_small",
        name="Depth Anything V2 (Small)",
        phase=5,
        feature="Monocular depth map driving the Depth & Bokeh workspace.",
        filename="depth_anything_v2_small.safetensors",
        url=("https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf/"
             "resolve/main/model.safetensors"),
        source_page="https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf",
        license="Apache-2.0",
        size_mb=99.0,
        min_vram_mb=1500,
        note="Smallest DA-V2 variant; runs on CPU and fits a 4 GB GPU.",
    ),

    # ---- Phase 6 — Upscaling & restoration -------------------------------
    ModelSpec(
        id="realesrgan_x4plus",
        name="Real-ESRGAN x4plus",
        phase=6,
        feature="4× photo upscaling and detail restoration.",
        filename="RealESRGAN_x4plus.pth",
        url=("https://github.com/xinntao/Real-ESRGAN/releases/download/"
             "v0.1.0/RealESRGAN_x4plus.pth"),
        source_page="https://github.com/xinntao/Real-ESRGAN",
        license="BSD-3-Clause",
        size_mb=67.0,
        min_vram_mb=2000,
        note="Tiled inference keeps VRAM in budget; CPU fallback is slower.",
    ),
    ModelSpec(
        id="realesrgan_x2plus",
        name="Real-ESRGAN x2plus",
        phase=6,
        feature="2× upscaling for lighter enlargements and denoise.",
        filename="RealESRGAN_x2plus.pth",
        url=("https://github.com/xinntao/Real-ESRGAN/releases/download/"
             "v0.2.1/RealESRGAN_x2plus.pth"),
        source_page="https://github.com/xinntao/Real-ESRGAN",
        license="BSD-3-Clause",
        size_mb=67.0,
        min_vram_mb=1500,
    ),

    # ---- Phase 7 — Restoration helpers + VLM infra -----------------------
    ModelSpec(
        id="gfpgan_v1_4",
        name="GFPGAN v1.4",
        phase=7,
        feature="Optional generative face restoration (gated behind a preview).",
        filename="GFPGANv1.4.pth",
        url=("https://github.com/TencentARC/GFPGAN/releases/download/"
             "v1.3.4/GFPGANv1.4.pth"),
        source_page="https://github.com/TencentARC/GFPGAN",
        license="Apache-2.0",
        size_mb=333.0,
        min_vram_mb=2000,
    ),
    ModelSpec(
        id="codeformer",
        name="CodeFormer",
        phase=7,
        feature="Optional robust face restoration with an identity-fidelity dial.",
        filename="codeformer.pth",
        url=("https://github.com/sczhou/CodeFormer/releases/download/"
             "v0.1.0/codeformer.pth"),
        source_page="https://github.com/sczhou/CodeFormer",
        license="NTU S-Lab License 1.0",
        size_mb=360.0,
        min_vram_mb=2000,
    ),
    ModelSpec(
        id="moondream2",
        name="Moondream 2 (VLM)",
        phase=7,
        feature="Optional local vision-language model for AI Color Match & Luma Assistant.",
        filename="moondream2",  # pulled via Ollama; informational
        url=None,
        source_page="https://huggingface.co/vikhyatk/moondream2",
        license="Apache-2.0",
        size_mb=1800.0,
        kind="vlm",
        min_vram_mb=3000,
        note="Install via Ollama (`ollama pull moondream`) or llama.cpp. Everything works with no VLM installed.",
    ),
    ModelSpec(
        id="smolvlm_500m",
        name="SmolVLM 500M (VLM)",
        phase=7,
        feature="Optional tiny vision-language model for low-memory machines.",
        filename="smolvlm-500m",
        url=None,
        source_page="https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct",
        license="Apache-2.0",
        size_mb=1000.0,
        kind="vlm",
        min_vram_mb=1500,
        note="Install via Ollama or llama.cpp. Optional.",
    ),
)

_BY_ID: dict[str, ModelSpec] = {m.id: m for m in _MODELS}


# ---------------------------------------------------------------------------
# Lookups & helpers
# ---------------------------------------------------------------------------


def all_models() -> tuple[ModelSpec, ...]:
    return _MODELS


def get(model_id: str) -> ModelSpec | None:
    return _BY_ID.get(model_id)


def is_safe_url(url: str | None) -> bool:
    """True iff ``url`` is HTTPS and hosted on an allowlisted trusted host."""
    if not url:
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme != "https" or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    return any(host == safe or host.endswith("." + safe) for safe in SAFE_HOSTS)


def model_path(spec: ModelSpec) -> Path:
    return get_settings().models_dir / spec.filename


def is_installed(spec: ModelSpec) -> bool:
    """A model counts as installed if its file exists and is plausibly sized.

    We only trust files that are at least ~70 % of the advertised size, so a
    half-finished or truncated download never reads as ready.
    """
    p = model_path(spec)
    if not p.exists() or not p.is_file():
        return False
    floor = max(1, int(spec.size_mb * 1024 * 1024 * 0.7))
    return p.stat().st_size >= floor


def disk_size(spec: ModelSpec) -> int:
    p = model_path(spec)
    return p.stat().st_size if p.exists() and p.is_file() else 0
