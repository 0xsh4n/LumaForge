// TypeScript mirror of the backend's app/schemas.py. Keeping these in sync is
// the contract between the UI and the processing pipeline.

export interface LightAdjust {
  exposure: number; // EV, -5..5
  contrast: number; // -100..100
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
}

export interface ColorAdjust {
  temperature: number; // -100..100
  tint: number;
  vibrance: number;
  saturation: number;
  hue: number; // -180..180
}

export interface DetailAdjust {
  sharpen_amount: number; // 0..100
  sharpen_radius: number; // 0.3..3.0
  sharpen_detail: number; // 0..100
  sharpen_masking: number; // 0..100
  texture: number; // -100..100
  clarity: number;
  dehaze: number;
  noise_reduction: number; // 0..100
}

export interface EffectsAdjust {
  vignette: number; // -100..100
  grain: number; // 0..100
  defringe: number; // 0..100 (CA fringe reduction)
  distortion: number; // -100..100 (barrel/pincushion correction)
}

export type RawWbMode = "camera" | "auto" | "daylight";
export type DemosaicAlgo = "AHD" | "VNG" | "DCB" | "AAHD" | "LMMSE" | "DHT" | "LINEAR";

export interface RawParams {
  wb_mode: RawWbMode;
  exposure: number; // -2..3 EV at RAW stage
  highlight_mode: number; // 0..5
  demosaic: DemosaicAlgo;
  noise_reduction: number; // 0..2
}

export type CurvePoint = [number, number];

export interface CurvesAdjust {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export interface HSLBand {
  hue: number;
  saturation: number;
  luminance: number;
}

export type HSLBandName =
  | "red" | "orange" | "yellow" | "green"
  | "aqua" | "blue" | "purple" | "magenta";

export type HSLAdjust = Record<HSLBandName, HSLBand>;

export interface ColorWheel {
  r: number;
  g: number;
  b: number;
  luminance: number;
}

export interface ColorBalance {
  shadows: ColorWheel;
  midtones: ColorWheel;
  highlights: ColorWheel;
  globe: ColorWheel;
}

export interface SplitTone {
  shadow_hue: number;
  shadow_sat: number;
  highlight_hue: number;
  highlight_sat: number;
  balance: number;
}

export interface Grade {
  curves: CurvesAdjust;
  hsl: HSLAdjust;
  color_balance: ColorBalance;
  split_tone: SplitTone;
  lut_id: string | null;
  lut_intensity: number;
}

export interface PortraitAdjust {
  enabled: boolean;
  skin_smoothing: number;
  texture_preservation: number;
  blemish_removal: number;
  eye_enhance: number;
  eye_brightness: number;
  teeth_whiten: number;
  face_exposure: number;
  face_sharpen: number;
  hair_enhance: number;
  under_eye: number;
  face_noise_reduction: number;
  background_exposure: number;
  background_saturation: number;
  intensity: number;
  naturalness: number;
}

export interface PortraitMode {
  id: string;
  label: string;
  params: PortraitAdjust;
}

// ---- Masking engine (Phase 4) ----
export interface LocalAdjust {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  clarity: number;
  sharpness: number;
  blur: number;
}

export interface BrushDab {
  x: number;
  y: number;
  radius: number;
  hardness: number;
  erase: boolean;
}

export type MaskType = "linear" | "radial" | "brush";

export interface Mask {
  id: string;
  name: string;
  type: MaskType;
  enabled: boolean;
  invert: boolean;
  opacity: number;
  feather: number;
  angle: number;
  start: number;
  end: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  dabs: BrushDab[];
  local: LocalAdjust;
}

// ---- Motion & lens effects (Phase 5) ----
export type MotionType = "none" | "linear" | "zoom" | "spin";

export interface MotionAdjust {
  type: MotionType;
  amount: number;
  angle: number;
  cx: number;
  cy: number;
}

export interface Adjustments {
  light: LightAdjust;
  color: ColorAdjust;
  detail: DetailAdjust;
  effects: EffectsAdjust;
  grade: Grade;
  portrait: PortraitAdjust;
  masks: Mask[];
  motion: MotionAdjust;
}

export interface LutInfo {
  id: string;
  name: string;
  dim: number;
  size: number;
}

export type AdjustGroup = keyof Adjustments;

export interface ImageMeta {
  id: string;
  filename: string;
  source_path: string | null;
  width: number;
  height: number;
  channels: number;
  bit_depth: number;
  format: string;
  megapixels: number;
  exif: Record<string, string>;
  is_raw: boolean;
  raw_params: RawParams | null;
}

export interface Histogram {
  bins: number;
  red: number[];
  green: number[];
  blue: number[];
  luma: number[];
}

export interface ImageAnalysis {
  mean_luma: number;
  median_luma: number;
  black_clip_pct: number;
  white_clip_pct: number;
  contrast_std: number;
  estimated_temp_bias: number;
  estimated_tint_bias: number;
  sharpness: number;
  histogram: Histogram;
}

export interface GpuInfo {
  name: string;
  vram_total_mb: number;
  vram_free_mb: number;
  vram_used_mb: number;
  driver_version: string;
}

export interface HardwareReport {
  os: { system: string; release: string; machine: string; python: string };
  cpu: {
    cores_logical: number;
    processor: string;
    opencv_version: string;
    opencv_threads: number;
    numpy_version: string;
  };
  gpus: GpuInfo[];
  nvidia_detected: boolean;
  cuda_available: boolean;
  ml_runtimes: Record<string, unknown>;
  active_processing_device: string;
  gpu_acceleration_note: string;
  formats: {
    raster: string[];
    heif: string[];
    raw: string[];
    heif_available: boolean;
    raw_available: boolean;
    all_importable: string[];
  };
}

// ---- Model Manager (Phase 7 §25) ----
export type ModelState = "available" | "installed" | "downloading" | "verifying" | "error";

export interface ModelProgress {
  state: string;
  downloaded: number;
  total: number;
  pct: number;
  error: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  phase: number;
  feature: string;
  filename: string;
  source_page: string;
  license: string;
  size_mb: number;
  kind: "image" | "vlm";
  min_vram_mb: number;
  note: string;
  auto_downloadable: boolean;
  installed: boolean;
  disk_bytes: number;
  state: ModelState;
  progress: ModelProgress;
}

export interface ModelStorage {
  dir: string;
  total_bytes: number;
  total_human: string;
  installed_count: number;
}

export interface ModelListResponse {
  models: ModelInfo[];
  storage: ModelStorage;
}

export interface ExportResult {
  path: string;
  width: number;
  height: number;
  bytes_written: number;
  format: string;
}

export type ExportFormat = "jpeg" | "png" | "webp" | "tiff";

export type AutoMode = "natural" | "professional" | "cinematic";

export interface AutoEnhanceResult {
  adjustments: Adjustments;
  mode: string;
  strength: number;
  notes: string[];
  scene: {
    mean_luma: number;
    contrast: number;
    cast: string;
    noisy: boolean;
  };
}
