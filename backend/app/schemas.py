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
    # Lens corrections (general; also surfaced in RAW develop)
    defringe: float = Field(0.0, ge=0, le=100, description="chromatic-aberration fringe reduction")
    distortion: float = Field(0.0, ge=-100, le=100, description="barrel(-)/pincushion(+) correction")


class RawParams(BaseModel):
    """Decode-time RAW develop parameters (applied by LibRaw/rawpy).

    Changing these re-decodes the sensor data; fine tonal/colour work is then
    done with the normal adjustment sliders on top.
    """

    wb_mode: Literal["camera", "auto", "daylight"] = "camera"
    exposure: float = Field(0.0, ge=-2.0, le=3.0, description="EV at the RAW stage")
    highlight_mode: int = Field(0, ge=0, le=5, description="0 clip · 1 ignore · 2 blend · 3-5 reconstruct")
    demosaic: Literal["AHD", "VNG", "DCB", "AAHD", "LMMSE", "DHT", "LINEAR"] = "AHD"
    noise_reduction: int = Field(0, ge=0, le=2, description="FBDD: 0 off · 1 light · 2 full")


# --------------------------- Color grading (Phase 2b) ----------------------

def _linear_curve() -> list[list[float]]:
    return [[0.0, 0.0], [1.0, 1.0]]


class CurvesAdjust(BaseModel):
    """Tone curves as control points (x,y) in [0,1]; default is linear (identity)."""

    rgb: list[list[float]] = Field(default_factory=_linear_curve)
    red: list[list[float]] = Field(default_factory=_linear_curve)
    green: list[list[float]] = Field(default_factory=_linear_curve)
    blue: list[list[float]] = Field(default_factory=_linear_curve)


class HSLBand(BaseModel):
    hue: float = Field(0.0, ge=-100, le=100)
    saturation: float = Field(0.0, ge=-100, le=100)
    luminance: float = Field(0.0, ge=-100, le=100)


class HSLAdjust(BaseModel):
    red: HSLBand = Field(default_factory=HSLBand)
    orange: HSLBand = Field(default_factory=HSLBand)
    yellow: HSLBand = Field(default_factory=HSLBand)
    green: HSLBand = Field(default_factory=HSLBand)
    aqua: HSLBand = Field(default_factory=HSLBand)
    blue: HSLBand = Field(default_factory=HSLBand)
    purple: HSLBand = Field(default_factory=HSLBand)
    magenta: HSLBand = Field(default_factory=HSLBand)


class ColorWheel(BaseModel):
    """A 3-way color-balance zone: RGB push + luminance offset, all -100..100."""

    r: float = Field(0.0, ge=-100, le=100)
    g: float = Field(0.0, ge=-100, le=100)
    b: float = Field(0.0, ge=-100, le=100)
    luminance: float = Field(0.0, ge=-100, le=100)


class ColorBalance(BaseModel):
    shadows: ColorWheel = Field(default_factory=ColorWheel)
    midtones: ColorWheel = Field(default_factory=ColorWheel)
    highlights: ColorWheel = Field(default_factory=ColorWheel)
    globe: ColorWheel = Field(default_factory=ColorWheel)  # "global" (reserved word)


class SplitTone(BaseModel):
    shadow_hue: float = Field(0.0, ge=0, le=360)
    shadow_sat: float = Field(0.0, ge=0, le=100)
    highlight_hue: float = Field(0.0, ge=0, le=360)
    highlight_sat: float = Field(0.0, ge=0, le=100)
    balance: float = Field(0.0, ge=-100, le=100)


class Grade(BaseModel):
    """Professional color-grading stack (Color Studio). All-neutral by default."""

    curves: CurvesAdjust = Field(default_factory=CurvesAdjust)
    hsl: HSLAdjust = Field(default_factory=HSLAdjust)
    color_balance: ColorBalance = Field(default_factory=ColorBalance)
    split_tone: SplitTone = Field(default_factory=SplitTone)
    lut_id: Optional[str] = None
    lut_intensity: float = Field(100.0, ge=0, le=100)


# --------------------------- Portrait (Phase 3) ----------------------------


class PortraitAdjust(BaseModel):
    """Face-aware retouch parameters (Portrait Studio).

    Applied only within detected face-region masks; geometry is never altered,
    so the subject's identity is preserved. Disabled by default.
    """

    enabled: bool = False
    skin_smoothing: float = Field(0.0, ge=0, le=100)
    texture_preservation: float = Field(55.0, ge=0, le=100)
    blemish_removal: float = Field(0.0, ge=0, le=100)
    eye_enhance: float = Field(0.0, ge=0, le=100)
    eye_brightness: float = Field(0.0, ge=0, le=100)
    teeth_whiten: float = Field(0.0, ge=0, le=100)
    face_exposure: float = Field(0.0, ge=-100, le=100)
    face_sharpen: float = Field(0.0, ge=0, le=100)
    hair_enhance: float = Field(0.0, ge=0, le=100)
    under_eye: float = Field(0.0, ge=0, le=100)
    face_noise_reduction: float = Field(0.0, ge=0, le=100)
    background_exposure: float = Field(0.0, ge=-100, le=100)
    background_saturation: float = Field(0.0, ge=-100, le=100)
    intensity: float = Field(100.0, ge=0, le=100)
    naturalness: float = Field(70.0, ge=0, le=100)


# --------------------------- Masking engine (Phase 4) ----------------------


class LocalAdjust(BaseModel):
    """Tonal/colour/detail changes applied only *within* a mask.

    A focused subset of the global sliders — the moves that are useful locally.
    ``blur`` is a selective defocus (the classical, model-free part of the
    DSLR-look / depth story); ``sharpness`` its opposite. All neutral by default,
    so a mask with no local edits is a no-op.
    """

    exposure: float = Field(0.0, ge=-5.0, le=5.0)
    contrast: float = Field(0.0, ge=-100, le=100)
    highlights: float = Field(0.0, ge=-100, le=100)
    shadows: float = Field(0.0, ge=-100, le=100)
    whites: float = Field(0.0, ge=-100, le=100)
    blacks: float = Field(0.0, ge=-100, le=100)
    temperature: float = Field(0.0, ge=-100, le=100)
    tint: float = Field(0.0, ge=-100, le=100)
    saturation: float = Field(0.0, ge=-100, le=100)
    vibrance: float = Field(0.0, ge=-100, le=100)
    clarity: float = Field(0.0, ge=-100, le=100)
    sharpness: float = Field(0.0, ge=0, le=100)
    blur: float = Field(0.0, ge=0, le=100, description="selective defocus")


class BrushDab(BaseModel):
    """One painted circular dab, normalized to [0,1] so it scales to any render."""

    x: float = Field(0.5, ge=0, le=1)
    y: float = Field(0.5, ge=0, le=1)
    radius: float = Field(0.08, gt=0, le=2.0, description="fraction of the long edge")
    hardness: float = Field(0.5, ge=0, le=1)
    erase: bool = False


class Mask(BaseModel):
    """A selection whose geometry is parameters, not baked pixels.

    Three classical (model-free) kinds: ``linear`` and ``radial`` gradients and a
    ``brush``. Each carries its own :class:`LocalAdjust`. AI subject/sky masks
    (BiRefNet/SAM) will slot in as further ``type`` values in a later pass.
    """

    id: str
    name: str = "Mask"
    type: Literal["linear", "radial", "brush"] = "radial"
    enabled: bool = True
    invert: bool = False
    opacity: float = Field(100.0, ge=0, le=100)
    feather: float = Field(50.0, ge=0, le=100)
    # linear gradient: direction + the two stops along it (0..1 of the image span)
    angle: float = Field(0.0, ge=-180, le=180)
    start: float = Field(0.35, ge=-1.0, le=2.0)
    end: float = Field(0.65, ge=-1.0, le=2.0)
    # radial / brush center and (radial) radii, as fractions of width/height
    cx: float = Field(0.5, ge=0, le=1)
    cy: float = Field(0.5, ge=0, le=1)
    rx: float = Field(0.35, gt=0, le=2.0)
    ry: float = Field(0.35, gt=0, le=2.0)
    dabs: list[BrushDab] = Field(default_factory=list)
    local: LocalAdjust = Field(default_factory=LocalAdjust)


# --------------------- Motion & lens effects (Phase 5) ---------------------


class MotionAdjust(BaseModel):
    """Creative motion blur applied to the whole frame.

    ``linear`` is directional (convolution line kernel); ``zoom`` and ``spin``
    are radial/rotational blurs about a center. Selective (subject/background)
    motion is achieved by masking a ``blur`` LocalAdjust; this is the global look.
    """

    type: Literal["none", "linear", "zoom", "spin"] = "none"
    amount: float = Field(0.0, ge=0, le=100)
    angle: float = Field(0.0, ge=-180, le=180, description="direction for linear")
    cx: float = Field(0.5, ge=0, le=1, description="center for zoom/spin")
    cy: float = Field(0.5, ge=0, le=1)


class Adjustments(BaseModel):
    """Complete non-destructive edit description."""

    light: LightAdjust = Field(default_factory=LightAdjust)
    color: ColorAdjust = Field(default_factory=ColorAdjust)
    detail: DetailAdjust = Field(default_factory=DetailAdjust)
    effects: EffectsAdjust = Field(default_factory=EffectsAdjust)
    grade: Grade = Field(default_factory=Grade)
    portrait: PortraitAdjust = Field(default_factory=PortraitAdjust)
    masks: list[Mask] = Field(default_factory=list)
    motion: MotionAdjust = Field(default_factory=MotionAdjust)


# ---------------------------------------------------------------------------
# Requests / responses
# ---------------------------------------------------------------------------


class ImportByPathRequest(BaseModel):
    path: str


class RawDevelopRequest(BaseModel):
    raw_params: RawParams = Field(default_factory=RawParams)


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
    is_raw: bool = False
    raw_params: Optional[RawParams] = None


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
