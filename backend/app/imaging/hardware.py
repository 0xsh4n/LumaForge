"""Hardware & capability detection for the Settings → compatibility report.

Phase 1 processing is CPU-based NumPy/OpenCV, so we never *claim* GPU use here.
We do detect NVIDIA hardware and CUDA availability so the UI can show an honest
compatibility report and so later phases (AI models via ONNX Runtime / PyTorch)
can pick an execution provider and respect VRAM limits.
"""
from __future__ import annotations

import os
import platform
import shutil
import subprocess
from functools import lru_cache

import cv2
import numpy as np

from . import io as imgio


def _query_nvidia_smi() -> list[dict]:
    """Return a list of NVIDIA GPUs via nvidia-smi, or [] if unavailable."""
    exe = shutil.which("nvidia-smi")
    if not exe:
        return []
    try:
        out = subprocess.run(
            [exe,
             "--query-gpu=name,memory.total,memory.free,memory.used,driver_version",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode != 0:
            return []
    except Exception:
        return []
    gpus: list[dict] = []
    for line in out.stdout.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue
        name, total, free, used, driver = parts[:5]
        gpus.append({
            "name": name,
            "vram_total_mb": int(float(total)),
            "vram_free_mb": int(float(free)),
            "vram_used_mb": int(float(used)),
            "driver_version": driver,
        })
    return gpus


def _detect_cuda_runtimes() -> dict:
    """Which ML runtimes with CUDA are installed (for later AI phases)."""
    info = {"torch": None, "onnxruntime": None}
    try:
        import torch  # type: ignore

        info["torch"] = {
            "version": torch.__version__,
            "cuda_available": bool(torch.cuda.is_available()),
            "cuda_version": getattr(torch.version, "cuda", None),
        }
    except Exception:
        pass
    try:
        import onnxruntime as ort  # type: ignore

        providers = ort.get_available_providers()
        info["onnxruntime"] = {
            "version": ort.__version__,
            "providers": providers,
            "cuda_available": "CUDAExecutionProvider" in providers,
        }
    except Exception:
        pass
    return info


@lru_cache
def static_report() -> dict:
    """Information that does not change during a session (cached)."""
    gpus = _query_nvidia_smi()
    runtimes = _detect_cuda_runtimes()

    cuda_available = bool(
        (runtimes["torch"] and runtimes["torch"]["cuda_available"])
        or (runtimes["onnxruntime"] and runtimes["onnxruntime"]["cuda_available"])
    )

    return {
        "os": {
            "system": platform.system(),
            "release": platform.release(),
            "machine": platform.machine(),
            "python": platform.python_version(),
        },
        "cpu": {
            "cores_logical": os.cpu_count(),
            "processor": platform.processor() or platform.machine(),
            "opencv_version": cv2.__version__,
            "opencv_threads": cv2.getNumThreads(),
            "numpy_version": np.__version__,
        },
        "gpus": gpus,
        "nvidia_detected": len(gpus) > 0,
        "cuda_available": cuda_available,
        "ml_runtimes": runtimes,
        # Phase 1 is classical CPU processing. This is stated plainly so the UI
        # never implies GPU work that isn't happening.
        "active_processing_device": "cpu",
        "gpu_acceleration_note": (
            "GPU acceleration applies to AI features (upscaling, face restoration, "
            "segmentation) added in later phases. Manual adjustments, Auto Enhance "
            "and export run on the CPU."
        ),
        "formats": imgio.supported_extensions(),
    }


def live_report() -> dict:
    """Static report plus a fresh VRAM reading (not cached)."""
    rep = dict(static_report())
    rep["gpus"] = _query_nvidia_smi() or rep["gpus"]
    return rep
