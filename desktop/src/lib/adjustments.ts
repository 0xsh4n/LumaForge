import type {
  Adjustments,
  AdjustGroup,
  Grade,
  HSLBandName,
  LocalAdjust,
  Mask,
  MaskType,
  MotionAdjust,
  PortraitAdjust,
} from "../types";

export const HSL_BANDS: HSLBandName[] = [
  "red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta",
];

const linear = (): [number, number][] => [
  [0, 0],
  [1, 1],
];

export function neutralGrade(): Grade {
  const band = () => ({ hue: 0, saturation: 0, luminance: 0 });
  const wheel = () => ({ r: 0, g: 0, b: 0, luminance: 0 });
  return {
    curves: { rgb: linear(), red: linear(), green: linear(), blue: linear() },
    hsl: {
      red: band(), orange: band(), yellow: band(), green: band(),
      aqua: band(), blue: band(), purple: band(), magenta: band(),
    },
    color_balance: {
      shadows: wheel(), midtones: wheel(), highlights: wheel(), globe: wheel(),
    },
    split_tone: {
      shadow_hue: 0, shadow_sat: 0, highlight_hue: 0, highlight_sat: 0, balance: 0,
    },
    lut_id: null,
    lut_intensity: 100,
  };
}

export function neutralPortrait(): PortraitAdjust {
  return {
    enabled: false,
    skin_smoothing: 0, texture_preservation: 55, blemish_removal: 0,
    eye_enhance: 0, eye_brightness: 0, teeth_whiten: 0,
    face_exposure: 0, face_sharpen: 0, hair_enhance: 0, under_eye: 0,
    face_noise_reduction: 0, background_exposure: 0, background_saturation: 0,
    intensity: 100, naturalness: 70,
  };
}

export function neutralLocal(): LocalAdjust {
  return {
    exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
    temperature: 0, tint: 0, saturation: 0, vibrance: 0, clarity: 0,
    sharpness: 0, blur: 0,
  };
}

export function neutralMotion(): MotionAdjust {
  return { type: "none", amount: 0, angle: 0, cx: 0.5, cy: 0.5 };
}

const MASK_TYPE_NAME: Record<MaskType, string> = {
  linear: "Linear Gradient",
  radial: "Radial Gradient",
  brush: "Brush",
};

/** Build a fresh mask of the given kind with sensible default geometry. */
export function makeMask(type: MaskType, index: number): Mask {
  return {
    id: `mask_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${MASK_TYPE_NAME[type]} ${index}`,
    type,
    enabled: true,
    invert: false,
    opacity: 100,
    feather: 50,
    angle: type === "linear" ? 90 : 0, // linear defaults to a top→bottom gradient
    start: 0.35,
    end: 0.65,
    cx: 0.5,
    cy: 0.5,
    rx: 0.35,
    ry: 0.35,
    dabs: [],
    local: neutralLocal(),
  };
}

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
    effects: { vignette: 0, grain: 0, defringe: 0, distortion: 0 },
    grade: neutralGrade(),
    portrait: neutralPortrait(),
    masks: [],
    motion: neutralMotion(),
  };
}

export function cloneAdjustments(a: Adjustments): Adjustments {
  // Structured deep clone keeps the nested grade (curves arrays, wheels) safe.
  return JSON.parse(JSON.stringify(a)) as Adjustments;
}

export function isNeutral(a: Adjustments): boolean {
  const n = neutralAdjustments();
  return JSON.stringify(a) === JSON.stringify(n);
}

/** Linear interpolation of the scalar groups (used by the Auto Enhance strength
 *  slider). The nested `grade` stack is not interpolated — Auto Enhance never
 *  sets it — so `out.grade` keeps `b`'s grade. */
export function lerpAdjustments(a: Adjustments, b: Adjustments, t: number): Adjustments {
  const out = neutralAdjustments();
  (["light", "color", "detail", "effects"] as AdjustGroup[]).forEach((group) => {
    const ga = a[group] as unknown as Record<string, number>;
    const gb = b[group] as unknown as Record<string, number>;
    const go = out[group] as unknown as Record<string, number>;
    Object.keys(go).forEach((k) => {
      go[k] = +(ga[k] + (gb[k] - ga[k]) * t).toFixed(2);
    });
  });
  out.grade = JSON.parse(JSON.stringify(b.grade));
  out.portrait = JSON.parse(JSON.stringify(b.portrait));
  // Masks and motion are not interpolated (Auto Enhance never sets them).
  out.masks = JSON.parse(JSON.stringify(b.masks));
  out.motion = JSON.parse(JSON.stringify(b.motion));
  return out;
}

/** Scale a look's light/color/detail/effects/grade from neutral by t∈[0,1].
 *  Used by AI Color Match's Intensity control. Grade scaling covers the fields
 *  Color Match actually sets (split-tone saturations and colour-balance wheels);
 *  curves/HSL/LUT are left as the look defines them. masks/motion are untouched
 *  (Color Match preserves the user's existing ones at the call site). */
export function scaleLookFromNeutral(look: Adjustments, t: number): Adjustments {
  const out = cloneAdjustments(look);
  const n = neutralAdjustments();
  (["light", "color", "detail", "effects"] as AdjustGroup[]).forEach((group) => {
    const gl = look[group] as unknown as Record<string, number>;
    const gn = n[group] as unknown as Record<string, number>;
    const go = out[group] as unknown as Record<string, number>;
    Object.keys(go).forEach((k) => {
      go[k] = +(gn[k] + (gl[k] - gn[k]) * t).toFixed(2);
    });
  });
  out.grade.split_tone.shadow_sat = +(look.grade.split_tone.shadow_sat * t).toFixed(2);
  out.grade.split_tone.highlight_sat = +(look.grade.split_tone.highlight_sat * t).toFixed(2);
  (["shadows", "midtones", "highlights", "globe"] as const).forEach((zone) => {
    const w = out.grade.color_balance[zone];
    const lw = look.grade.color_balance[zone];
    w.r = +(lw.r * t).toFixed(2);
    w.g = +(lw.g * t).toFixed(2);
    w.b = +(lw.b * t).toFixed(2);
    w.luminance = +(lw.luminance * t).toFixed(2);
  });
  return out;
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
      { key: "vignette", label: "Vignette", min: -100, max: 100, step: 1, default: 0, bipolar: true, sub: "Effects" },
      { key: "grain", label: "Grain", min: 0, max: 100, step: 1, default: 0, sub: "Effects" },
      { key: "defringe", label: "Defringe (CA)", min: 0, max: 100, step: 1, default: 0, sub: "Lens Corrections" },
      { key: "distortion", label: "Distortion", min: -100, max: 100, step: 1, default: 0, bipolar: true, sub: "Lens Corrections" },
    ],
  },
];
