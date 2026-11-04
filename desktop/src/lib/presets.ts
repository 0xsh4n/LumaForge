import type { Adjustments } from "../types";
import { neutralAdjustments } from "./adjustments";

export interface Preset {
  id: string;
  name: string;
  description: string;
  /** partial overrides applied on top of a neutral base */
  build: () => Adjustments;
}

function base(overrides: (a: Adjustments) => void): Adjustments {
  const a = neutralAdjustments();
  overrides(a);
  return a;
}

// Starter looks shipped with Phase 1. Each is a transparent set of manual
// adjustments — selecting one simply loads these values, which the user can
// then inspect and tweak like any other edit (non-destructive).
export const PRESETS: Preset[] = [
  {
    id: "clean",
    name: "Clean & True",
    description: "A gentle, faithful baseline — balanced contrast and natural color.",
    build: () =>
      base((a) => {
        a.light.contrast = 8;
        a.light.shadows = 12;
        a.light.highlights = -10;
        a.color.vibrance = 10;
        a.detail.clarity = 6;
        a.detail.sharpen_amount = 22;
        a.detail.sharpen_masking = 30;
      }),
  },
  {
    id: "crisp-portrait",
    name: "Crisp Portrait",
    description: "Soft tone roll-off with eye-friendly clarity and skin-safe masking.",
    build: () =>
      base((a) => {
        a.light.contrast = 6;
        a.light.highlights = -22;
        a.light.shadows = 18;
        a.light.whites = 8;
        a.color.temperature = 6;
        a.color.vibrance = 14;
        a.color.saturation = -4;
        a.detail.texture = 10;
        a.detail.clarity = -4;
        a.detail.sharpen_amount = 30;
        a.detail.sharpen_masking = 55;
      }),
  },
  {
    id: "golden",
    name: "Golden Hour",
    description: "Warm, luminous grade for late-afternoon light.",
    build: () =>
      base((a) => {
        a.light.exposure = 0.12;
        a.light.contrast = 14;
        a.light.highlights = -18;
        a.light.shadows = 20;
        a.color.temperature = 22;
        a.color.tint = 6;
        a.color.vibrance = 18;
        a.detail.clarity = 8;
        a.effects.vignette = 14;
      }),
  },
  {
    id: "mono",
    name: "Mono Contrast",
    description: "High-contrast black & white with deep blacks and bright whites.",
    build: () =>
      base((a) => {
        a.light.contrast = 34;
        a.light.blacks = -18;
        a.light.whites = 14;
        a.light.shadows = 8;
        a.color.saturation = -100;
        a.detail.clarity = 16;
        a.detail.sharpen_amount = 28;
        a.detail.sharpen_masking = 40;
        a.effects.grain = 12;
      }),
  },
  {
    id: "cinematic",
    name: "Cinematic Cool",
    description: "Teal-leaning shadows, muted highlights, filmic restraint.",
    build: () =>
      base((a) => {
        a.light.contrast = 10;
        a.light.highlights = -28;
        a.light.shadows = 22;
        a.light.blacks = -10;
        a.color.temperature = -12;
        a.color.tint = -4;
        a.color.saturation = -8;
        a.color.vibrance = 10;
        a.detail.clarity = 6;
        a.detail.dehaze = 8;
        a.effects.vignette = 20;
        a.effects.grain = 8;
      }),
  },
  {
    id: "landscape",
    name: "Landscape Punch",
    description: "Dynamic range recovery with crisp detail and rich greens/blues.",
    build: () =>
      base((a) => {
        a.light.contrast = 16;
        a.light.highlights = -40;
        a.light.shadows = 30;
        a.light.whites = 12;
        a.light.blacks = -8;
        a.color.vibrance = 24;
        a.color.saturation = 4;
        a.detail.texture = 18;
        a.detail.clarity = 14;
        a.detail.dehaze = 14;
        a.detail.sharpen_amount = 36;
        a.detail.sharpen_masking = 35;
      }),
  },
];
