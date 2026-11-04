import type { Adjustments, AdjustGroup } from "../types";

export function neutralAdjustments(): Adjustments {
  return {
    light: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0 },
    color: { temperature: 0, tint: 0, vibrance: 0, saturation: 0, hue: 0 },
    detail: {
      sharpen_amount: 0,
      sharpen_radius: 1.0,
      sharpen_detail: 25,
      sharpen_masking: 0,
      texture: 0,
      clarity: 0,
      dehaze: 0,
      noise_reduction: 0,
    },
    effects: { vignette: 0, grain: 0 },
  };
}

export function cloneAdjustments(a: Adjustments): Adjustments {
  return {
    light: { ...a.light },
    color: { ...a.color },
    detail: { ...a.detail },
    effects: { ...a.effects },
  };
}

export function isNeutral(a: Adjustments): boolean {
  const n = neutralAdjustments();
  return JSON.stringify(a) === JSON.stringify(n);
}

export interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** bipolar sliders center the "0" tick and show a fill from the middle */
  bipolar?: boolean;
  /** group header this slider belongs to (for sub-sections like Sharpening) */
  sub?: string;
}

export interface GroupSpec {
  group: AdjustGroup;
  title: string;
  sliders: SliderSpec[];
}

export const EDITOR_GROUPS: GroupSpec[] = [
  {
    group: "light",
    title: "Light",
    sliders: [
      { key: "exposure", label: "Exposure", min: -5, max: 5, step: 0.01, default: 0, bipolar: true },
      { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "highlights", label: "Highlights", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "shadows", label: "Shadows", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "whites", label: "Whites", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "blacks", label: "Blacks", min: -100, max: 100, step: 1, default: 0, bipolar: true },
    ],
  },
  {
    group: "color",
    title: "Color",
    sliders: [
      { key: "temperature", label: "Temperature", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "tint", label: "Tint", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "vibrance", label: "Vibrance", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "hue", label: "Hue", min: -180, max: 180, step: 1, default: 0, bipolar: true },
    ],
  },
  {
    group: "detail",
    title: "Detail",
    sliders: [
      { key: "sharpen_amount", label: "Sharpening", min: 0, max: 100, step: 1, default: 0, sub: "Sharpening" },
      { key: "sharpen_radius", label: "Radius", min: 0.3, max: 3, step: 0.1, default: 1.0, sub: "Sharpening" },
      { key: "sharpen_detail", label: "Detail", min: 0, max: 100, step: 1, default: 25, sub: "Sharpening" },
      { key: "sharpen_masking", label: "Masking", min: 0, max: 100, step: 1, default: 0, sub: "Sharpening" },
      { key: "texture", label: "Texture", min: -100, max: 100, step: 1, default: 0, bipolar: true, sub: "Presence" },
      { key: "clarity", label: "Clarity", min: -100, max: 100, step: 1, default: 0, bipolar: true, sub: "Presence" },
      { key: "dehaze", label: "Dehaze", min: -100, max: 100, step: 1, default: 0, bipolar: true, sub: "Presence" },
      { key: "noise_reduction", label: "Noise Reduction", min: 0, max: 100, step: 1, default: 0, sub: "Noise" },
    ],
  },
  {
    group: "effects",
    title: "Effects",
    sliders: [
      { key: "vignette", label: "Vignette", min: -100, max: 100, step: 1, default: 0, bipolar: true },
      { key: "grain", label: "Grain", min: 0, max: 100, step: 1, default: 0 },
    ],
  },
];
