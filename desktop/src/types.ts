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
}

export interface Adjustments {
  light: LightAdjust;
  color: ColorAdjust;
  detail: DetailAdjust;
  effects: EffectsAdjust;
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
