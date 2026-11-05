"""Pydantic models shared across the API.

The adjustment models are the heart of the non-destructive contract: the UI
sends exactly these parameters, the pipeline interprets them, and a project
file is essentially these values plus a reference to the original image. Every
field defaults to a *neutral* value, so an empty ``Adjustments()`` renders the
untouched original.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Adjustment groups (mirror the right-hand editor panels)
# ---------------------------------------------------------------------------


class LightAdjust(BaseModel):
    exposure: float = Field(0.0, ge=-5.0, le=5.0, description="EV stops")
    contrast: float = Field(0.0, ge=-100, le=100)
    highlights: float = Field(0.0, ge=-100, le=100)
    shadows: float = Field(0.0, ge=-100, le=100)
    whites: float = Field(0.0, ge=-100, le=100)
    blacks: float = Field(0.0, ge=-100, le=100)


class ColorAdjust(BaseModel):
    temperature: float = Field(0.0, ge=-100, le=100, description="Blue↔Amber")
    tint: float = Field(0.0, ge=-100, le=100, description="Green↔Magenta")
    vibrance: float = Field(0.0, ge=-100, le=100)
    saturation: float = Field(0.0, ge=-100, le=100)
    hue: float = Field(0.0, ge=-180, le=180, description="Global hue rotation °")


class DetailAdjust(BaseModel):
    sharpen_amount: float = Field(0.0, ge=0, le=100)
    sharpen_radius: float = Field(1.0, ge=0.3, le=3.0)
    sharpen_detail: float = Field(25.0, ge=0, le=100)
    sharpen_masking: float = Field(0.0, ge=0, le=100)
    texture: float = Field(0.0, ge=-100, le=100)
    clarity: float = Field(0.0, ge=-100, le=100)
    dehaze: float = Field(0.0, ge=-100, le=100)
    noise_reduction: float = Field(0.0, ge=0, le=100)


class EffectsAdjust(BaseModel):
    vignette: float = Field(0.0, ge=-100, le=100)
    grain: float = Field(0.0, ge=0, le=100)


class Adjustments(BaseModel):
    """Complete non-destructive edit description for Phase 1."""

    light: LightAdjust = Field(default_factory=LightAdjust)
    color: ColorAdjust = Field(default_factory=ColorAdjust)
    detail: DetailAdjust = Field(default_factory=DetailAdjust)
    effects: EffectsAdjust = Field(default_factory=EffectsAdjust)


# ---------------------------------------------------------------------------
# Requests / responses
# ---------------------------------------------------------------------------


class ImportByPathRequest(BaseModel):
    path: str


class ImageMeta(BaseModel):
    id: str
    filename: str
    source_path: Optional[str] = None
    width: int
    height: int
    channels: int
    bit_depth: int
    format: str
    megapixels: float
    exif: dict = Field(default_factory=dict)


class RenderRequest(BaseModel):
    adjustments: Adjustments = Field(default_factory=Adjustments)
    # Longest output edge in px. None → backend preview cap. Ignored for export.
    max_dim: Optional[int] = Field(default=None, ge=16, le=20000)
    format: Literal["jpeg", "png"] = "jpeg"
    quality: int = Field(90, ge=1, le=100)


class ExportRequest(BaseModel):
    adjustments: Adjustments = Field(default_factory=Adjustments)
    path: str
    format: Literal["jpeg", "png", "webp", "tiff"] = "jpeg"
    quality: int = Field(92, ge=1, le=100)
    # Resize longest edge on export. None keeps full resolution.
    resize_long_edge: Optional[int] = Field(default=None, ge=16, le=60000)
    keep_metadata: bool = True
    embed_srgb_profile: bool = True


class ExportResult(BaseModel):
    path: str
    width: int
    height: int
    bytes_written: int
    format: str


class Histogram(BaseModel):
    bins: int
    red: list[int]
    green: list[int]
    blue: list[int]
    luma: list[int]


class ImageAnalysis(BaseModel):
    """Lightweight statistics used by the UI and (later) Auto Enhance."""

    mean_luma: float
    median_luma: float
    black_clip_pct: float
    white_clip_pct: float
    contrast_std: float
    estimated_temp_bias: float  # <0 cool, >0 warm
    estimated_tint_bias: float  # <0 green, >0 magenta
    sharpness: float            # variance of Laplacian (higher = sharper)
    histogram: Histogram


class AutoEnhanceRequest(BaseModel):
    mode: Literal["natural", "professional", "cinematic"] = "natural"
    strength: float = Field(100.0, ge=0, le=100)


class AutoEnhanceResult(BaseModel):
    """An editable enhancement profile derived from image analysis."""

    adjustments: Adjustments
    mode: str
    strength: float
    notes: list[str]
    scene: dict


class ProjectFile(BaseModel):
    """On-disk project (.lfp) — original reference + parameters only."""

    schema_version: int = 1
    app_version: str
    name: str
    source_path: Optional[str]
    original_width: int
    original_height: int
    adjustments: Adjustments
    created_at: str
    modified_at: str
