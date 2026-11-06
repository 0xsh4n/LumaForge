import { create } from "zustand";
import { api, ApiError } from "../lib/api";
import {
  cloneAdjustments,
  isNeutral,
  lerpAdjustments,
  makeMask,
  neutralAdjustments,
  neutralGrade,
  scaleLookFromNeutral,
} from "../lib/adjustments";
import {
  pickImageToImport,
  pickSavePath,
  pickProjectOpenPath,
  pickFile,
  downloadBlob,
  isTauri,
} from "../lib/platform";
import type {
  Adjustments,
  AdjustGroup,
  AutoEnhanceResult,
  AutoMode,
  ColorMatchCard,
  ColorMatchScene,
  ExportFormat,
  Grade,
  HardwareReport,
  ImageAnalysis,
  ImageMeta,
  LocalAdjust,
  LutInfo,
  Mask,
  MaskType,
  ModelInfo,
  ModelStorage,
  MotionAdjust,
  PortraitAdjust,
  PortraitMode,
  RawParams,
  RecentProject,
} from "../types";

export type Section = "home" | "editor" | "ai" | "presets" | "settings";
export type CompareMode = "off" | "split" | "side";
export type PreviewQuality = "draft" | "standard" | "high";
type BackendStatus = "connecting" | "online" | "offline";

const PREVIEW_MAXDIM: Record<PreviewQuality, number> = {
  draft: 1024,
  standard: 1400,
  high: 1920,
};

interface ExportState {
  state: "idle" | "exporting" | "done" | "error";
  message?: string;
}

interface AutoEnhanceState {
  open: boolean;
  mode: AutoMode;
  strength: number;
  loading: boolean;
  error: string | null;
  notes: string[];
  scene: AutoEnhanceResult["scene"] | null;
}

interface PortraitState {
  open: boolean;
  modes: PortraitMode[];
  mode: string;
  detecting: boolean;
  faceCount: number;
  modelAvailable: boolean;
  message: string | null;
}

interface MaskPanelState {
  open: boolean;
  activeId: string | null;
}

interface ColorMatchState {
  open: boolean;
  loading: boolean;
  error: string | null;
  cards: ColorMatchCard[];
  scene: ColorMatchScene | null;
  activeCardId: string | null;
  intensity: number;
}

interface EditorState {
  section: Section;
  backend: { status: BackendStatus; version?: string; error?: string };
  hardware: HardwareReport | null;

  image: ImageMeta | null;
  adjustments: Adjustments;
  past: Adjustments[];
  future: Adjustments[];

  previewUrl: string | null;
  originalUrl: string | null;
  analysis: ImageAnalysis | null;

  rendering: boolean;
  renderError: string | null;
  importing: boolean;
  importError: string | null;
  exportState: ExportState;

  compare: CompareMode;
  splitPos: number;
  showOriginal: boolean; // momentary "hold to view before"
  zoom: number;
  fitToScreen: boolean;
  previewQuality: PreviewQuality;

  autoEnhance: AutoEnhanceState;
  portrait: PortraitState;
  maskPanel: MaskPanelState;
  colorMatch: ColorMatchState;
  luts: LutInfo[];
  lutError: string | null;
  developing: boolean; // RAW re-decode in progress

  models: ModelInfo[];
  modelStorage: ModelStorage | null;
  modelsLoading: boolean;
  modelError: string | null;

  recentProjects: RecentProject[];

  // --- actions ---
  setSection: (s: Section) => void;
  initBackend: () => Promise<void>;
  loadHardware: () => Promise<void>;

  loadModels: () => Promise<void>;
  downloadModel: (id: string) => Promise<void>;
  removeModel: (id: string) => Promise<void>;

  importImage: () => Promise<void>;
  openPath: (path: string) => Promise<void>;
  rawDevelop: (params: RawParams) => Promise<void>;
  closeImage: () => void;

  // projects (.lfp)
  loadRecentProjects: () => Promise<void>;
  saveProject: () => Promise<void>;
  openProjectDialog: () => Promise<void>;
  openProjectPath: (path: string) => Promise<void>;

  beginGesture: () => void;
  setAdjustment: (group: AdjustGroup, key: string, value: number) => void;
  endGesture: () => void;
  cancelGesture: () => void;
  applyAdjustments: (next: Adjustments, label?: string) => void;

  openAutoEnhance: () => Promise<void>;
  setAutoMode: (mode: AutoMode) => void;
  setAutoStrength: (strength: number) => void;
  applyAutoEnhance: () => void;
  cancelAutoEnhance: () => void;

  // portrait studio (Phase 3)
  openPortrait: () => Promise<void>;
  setPortraitMode: (mode: string) => void;
  setPortraitField: (field: keyof PortraitAdjust, value: number) => void;
  applyPortrait: () => void;
  cancelPortrait: () => void;

  // masking engine (Phase 4)
  openMaskPanel: () => void;
  closeMaskPanel: () => void;
  addMask: (type: MaskType) => void;
  removeMask: (id: string) => void;
  selectMask: (id: string | null) => void;
  setMaskField: (id: string, field: keyof Mask, value: number | boolean) => void;
  setMaskLocal: (id: string, field: keyof LocalAdjust, value: number) => void;

  // motion & lens effects (Phase 5)
  setMotionField: (field: keyof MotionAdjust, value: number | string) => void;

  // AI Color Match (Phase 7)
  openColorMatch: () => Promise<void>;
  selectColorMatchCard: (id: string) => void;
  setColorMatchIntensity: (v: number) => void;
  applyColorMatch: () => void;
  cancelColorMatch: () => void;

  // color grading (Phase 2b)
  setGradeLive: (grade: Grade) => void;
  resetGrade: () => void;
  loadLuts: () => Promise<void>;
  importLut: () => Promise<void>;
  selectLut: (id: string | null) => void;
  deleteLut: (id: string) => Promise<void>;
  exportLut: () => Promise<void>;

  undo: () => void;
  redo: () => void;
  reset: () => void;

  setCompare: (m: CompareMode) => void;
  setSplitPos: (p: number) => void;
  setShowOriginal: (b: boolean) => void;
  setZoom: (z: number, fit?: boolean) => void;
  setPreviewQuality: (q: PreviewQuality) => void;

  exportImage: (opts: {
    format: ExportFormat;
    quality: number;
    resizeLongEdge?: number | null;
  }) => Promise<void>;
}

// ---- model-download progress polling (module scope) -----------------------
let modelPollTimer: number | undefined;

function ensureModelPolling(get: () => EditorState) {
  if (modelPollTimer) return;
  modelPollTimer = window.setInterval(async () => {
    await get().loadModels();
    const active = get().models.some(
      (m) => m.state === "downloading" || m.state === "verifying",
    );
    if (!active) {
      window.clearInterval(modelPollTimer);
      modelPollTimer = undefined;
    }
  }, 1200);
}

// ---- render scheduler (module scope, outside React) -----------------------
let renderTimer: number | undefined;
let renderSeq = 0;
let inflight: AbortController | null = null;
let gestureSnapshot: Adjustments | null = null;

// Auto Enhance: full-strength profiles per mode, cached per image so the
// strength slider can interpolate instantly without re-hitting the backend.
let autoProfiles: Partial<Record<AutoMode, AutoEnhanceResult>> = {};

// Color Match: the adjustments at panel-open time, so a chosen look replaces the
// base look (light/color/detail/effects/grade) while preserving the user's
// portrait / masks / motion.
let colorMatchBase: Adjustments | null = null;

function applyColorCard(
  get: () => EditorState,
  set: (p: Partial<EditorState>) => void,
  card: ColorMatchCard,
  intensity: number,
) {
  const base = colorMatchBase ?? get().adjustments;
  const scaled = scaleLookFromNeutral(card.adjustments, Math.max(0, Math.min(1, intensity / 100)));
  const next = cloneAdjustments(base);
  next.light = scaled.light;
  next.color = scaled.color;
  next.detail = scaled.detail;
  next.effects = scaled.effects;
  next.grade = scaled.grade;
  set({ adjustments: next });
  scheduleRender(get, set, 0);
}

async function applyAuto(
  get: () => EditorState,
  set: (p: Partial<EditorState>) => void,
  mode: AutoMode,
  strength: number,
) {
  const { image, autoEnhance } = get();
  if (!image) return;
  let profile = autoProfiles[mode];
  if (!profile) {
    set({ autoEnhance: { ...autoEnhance, mode, strength, loading: true, error: null } });
    try {
      profile = await api.autoEnhance(image.id, mode, 100);
      autoProfiles[mode] = profile;
    } catch (e) {
      set({
        autoEnhance: {
          ...get().autoEnhance,
          loading: false,
          error: e instanceof ApiError ? e.message : "Auto Enhance failed",
        },
      });
      return;
    }
  }
  if (!get().autoEnhance.open) return; // panel closed while fetching
  const next = lerpAdjustments(neutralAdjustments(), profile.adjustments, strength / 100);
  set({
    adjustments: next,
    autoEnhance: {
      ...get().autoEnhance,
      mode,
      strength,
      loading: false,
      error: null,
      notes: profile.notes,
      scene: profile.scene,
    },
  });
  scheduleRender(get, set, 0);
}

function scheduleRender(get: () => EditorState, set: (p: Partial<EditorState>) => void, delay = 110) {
  if (renderTimer) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => void doRender(get, set), delay);
}

function loadMeta(
  get: () => EditorState,
  set: (p: Partial<EditorState>) => void,
  meta: ImageMeta,
) {
  const oldPreview = get().previewUrl;
  if (oldPreview) URL.revokeObjectURL(oldPreview);
  autoProfiles = {};
  gestureSnapshot = null;
  colorMatchBase = null;
  set({
    image: meta,
    adjustments: neutralAdjustments(),
    past: [],
    future: [],
    previewUrl: null,
    originalUrl: api.originalUrl(meta.id, 1920),
    analysis: null,
    compare: "off",
    zoom: 1,
    fitToScreen: true,
    importing: false,
    section: "editor",
    exportState: { state: "idle" },
    autoEnhance: {
      open: false,
      mode: "natural",
      strength: 100,
      loading: false,
      error: null,
      notes: [],
      scene: null,
    },
    portrait: {
      open: false,
      modes: get().portrait.modes, // keep loaded mode list
      mode: "natural",
      detecting: false,
      faceCount: 0,
      modelAvailable: get().portrait.modelAvailable,
      message: null,
    },
    maskPanel: { open: false, activeId: null },
    colorMatch: {
      open: false, loading: false, error: null, cards: [], scene: null,
      activeCardId: null, intensity: 100,
    },
  });
  scheduleRender(get, set, 0);
  api.analyze(meta.id).then((a) => set({ analysis: a })).catch(() => {});
}

async function doRender(get: () => EditorState, set: (p: Partial<EditorState>) => void) {
  const { image, adjustments, previewQuality } = get();
  if (!image) return;
  const seq = ++renderSeq;
  if (inflight) inflight.abort();
  inflight = new AbortController();
  set({ rendering: true, renderError: null });
  try {
    const blob = await api.render(image.id, adjustments, {
      maxDim: PREVIEW_MAXDIM[previewQuality],
      signal: inflight.signal,
    });
    if (seq !== renderSeq) return; // a newer render superseded this one
    const url = URL.createObjectURL(blob);
    const prev = get().previewUrl;
    if (prev) URL.revokeObjectURL(prev);
    set({ previewUrl: url, rendering: false });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    if (seq !== renderSeq) return;
    set({
      rendering: false,
      renderError: e instanceof ApiError ? e.message : "Preview failed",
    });
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  section: "home",
  backend: { status: "connecting" },
  hardware: null,

  image: null,
  adjustments: neutralAdjustments(),
  past: [],
  future: [],

  previewUrl: null,
  originalUrl: null,
  analysis: null,

  rendering: false,
  renderError: null,
  importing: false,
  importError: null,
  exportState: { state: "idle" },

  compare: "off",
  splitPos: 0.5,
  showOriginal: false,
  zoom: 1,
  fitToScreen: true,
  previewQuality: "standard",

  autoEnhance: {
    open: false,
    mode: "natural",
    strength: 100,
    loading: false,
    error: null,
    notes: [],
    scene: null,
  },
  portrait: {
    open: false,
    modes: [],
    mode: "natural",
    detecting: false,
    faceCount: 0,
    modelAvailable: true,
    message: null,
  },
  maskPanel: { open: false, activeId: null },
  colorMatch: {
    open: false, loading: false, error: null, cards: [], scene: null,
    activeCardId: null, intensity: 100,
  },
  luts: [],
  lutError: null,
  developing: false,

  models: [],
  modelStorage: null,
  modelsLoading: false,
  modelError: null,

  recentProjects: [],

  setSection: (s) => set({ section: s }),

  initBackend: async () => {
    set({ backend: { status: "connecting" } });
    try {
      const h = await api.health();
      set({ backend: { status: "online", version: h.version } });
      void get().loadHardware();
      void get().loadLuts();
      void get().loadRecentProjects();
    } catch (e) {
      set({
        backend: {
          status: "offline",
          error: e instanceof Error ? e.message : "cannot reach backend",
        },
      });
    }
  },

  loadHardware: async () => {
    try {
      set({ hardware: await api.hardware() });
    } catch {
      /* non-fatal */
    }
  },

  loadModels: async () => {
    set({ modelsLoading: true });
    try {
      const res = await api.listModels();
      set({ models: res.models, modelStorage: res.storage, modelsLoading: false });
    } catch (e) {
      set({
        modelsLoading: false,
        modelError: e instanceof ApiError ? e.message : "Could not load models",
      });
    }
  },

  downloadModel: async (id) => {
    set({ modelError: null });
    try {
      await api.downloadModel(id);
      await get().loadModels();
      ensureModelPolling(get);
    } catch (e) {
      // 400s carry an actionable message (manual placement / VLM via Ollama).
      set({ modelError: e instanceof ApiError ? e.message : "Download failed" });
      await get().loadModels();
    }
  },

  removeModel: async (id) => {
    set({ modelError: null });
    try {
      await api.removeModel(id);
    } catch (e) {
      set({ modelError: e instanceof ApiError ? e.message : "Remove failed" });
    }
    await get().loadModels();
  },

  importImage: async () => {
    set({ importing: true, importError: null });
    try {
      const pick = await pickImageToImport();
      if (!pick) {
        set({ importing: false });
        return;
      }
      const meta =
        pick.kind === "path"
          ? await api.importPath(pick.path)
          : await api.importUpload(pick.file);
      loadMeta(get, set, meta);
    } catch (e) {
      set({
        importing: false,
        importError: e instanceof ApiError ? e.message : "Import failed",
      });
    }
  },

  openPath: async (path) => {
    set({ importing: true, importError: null });
    try {
      const meta = await api.importPath(path);
      loadMeta(get, set, meta);
    } catch (e) {
      set({
        importing: false,
        importError: e instanceof ApiError ? e.message : "Import failed",
      });
    }
  },

  rawDevelop: async (params) => {
    const { image } = get();
    if (!image || !image.is_raw) return;
    set({ developing: true, importError: null });
    try {
      const meta = await api.rawDevelop(image.id, params);
      set({
        image: meta,
        // bust the cached original (same URL, new pixels after re-decode)
        originalUrl: api.originalUrl(meta.id, 1920) + "&t=" + Date.now(),
        developing: false,
      });
      scheduleRender(get, set, 0);
      api.analyze(meta.id).then((a) => set({ analysis: a })).catch(() => {});
    } catch (e) {
      set({
        developing: false,
        importError: e instanceof ApiError ? e.message : "RAW develop failed",
      });
    }
  },

  // ---- projects (.lfp) ----
  loadRecentProjects: async () => {
    try {
      set({ recentProjects: await api.recentProjects() });
    } catch {
      /* non-fatal */
    }
  },

  saveProject: async () => {
    const { image, adjustments } = get();
    if (!image) return;
    const base = image.filename.replace(/\.[^.]+$/, "") || "project";
    set({ exportState: { state: "exporting" } });
    try {
      if (isTauri()) {
        const path = await pickSavePath(`${base}.lfp`, "lfp");
        if (!path) {
          set({ exportState: { state: "idle" } });
          return;
        }
        const proj = await api.saveProject({
          path,
          name: base,
          source_path: image.source_path,
          original_width: image.width,
          original_height: image.height,
          adjustments,
        });
        set({ exportState: { state: "done", message: `Saved project → ${proj.name}.lfp` } });
        void get().loadRecentProjects();
      } else {
        // Browser: no server path — hand the user the .lfp JSON to download.
        const now = new Date().toISOString();
        const proj = {
          schema_version: 1,
          app_version: get().backend.version ?? "0.1.0",
          name: base,
          source_path: image.source_path,
          original_width: image.width,
          original_height: image.height,
          adjustments,
          created_at: now,
          modified_at: now,
        };
        downloadBlob(
          new Blob([JSON.stringify(proj, null, 2)], { type: "application/json" }),
          `${base}.lfp`,
        );
        set({ exportState: { state: "done", message: `Downloaded ${base}.lfp` } });
      }
    } catch (e) {
      set({
        exportState: { state: "error", message: e instanceof ApiError ? e.message : "Save failed" },
      });
    }
  },

  openProjectDialog: async () => {
    const path = await pickProjectOpenPath();
    if (path) await get().openProjectPath(path);
  },

  openProjectPath: async (path) => {
    set({ importing: true, importError: null });
    try {
      const proj = await api.openProject(path);
      if (!proj.source_path) {
        throw new ApiError(400, "This project has no linked source image to reopen.");
      }
      const meta = await api.importPath(proj.source_path);
      loadMeta(get, set, meta);
      // loadMeta resets to neutral; apply the saved look as the current edit.
      get().applyAdjustments(proj.adjustments);
      void get().loadRecentProjects();
    } catch (e) {
      set({
        importing: false,
        importError: e instanceof ApiError ? e.message : "Could not open project",
      });
    }
  },

  closeImage: () => {
    const prev = get().previewUrl;
    if (prev) URL.revokeObjectURL(prev);
    const id = get().image?.id;
    if (id) void api.deleteImage(id); // free the backend session promptly
    set({
      image: null,
      previewUrl: null,
      originalUrl: null,
      analysis: null,
      adjustments: neutralAdjustments(),
      past: [],
      future: [],
      section: "home",
    });
  },

  beginGesture: () => {
    if (!gestureSnapshot) gestureSnapshot = cloneAdjustments(get().adjustments);
  },

  setAdjustment: (group, key, value) => {
    const adjustments = cloneAdjustments(get().adjustments);
    (adjustments[group] as unknown as Record<string, number>)[key] = value;
    set({ adjustments });
    scheduleRender(get, set);
  },

  endGesture: () => {
    if (!gestureSnapshot) return;
    const snapshot = gestureSnapshot;
    gestureSnapshot = null;
    const current = get().adjustments;
    if (JSON.stringify(snapshot) === JSON.stringify(current)) return; // no change
    set({ past: [...get().past, snapshot], future: [] });
  },

  cancelGesture: () => {
    if (!gestureSnapshot) return;
    const snapshot = gestureSnapshot;
    gestureSnapshot = null;
    set({ adjustments: cloneAdjustments(snapshot) });
    scheduleRender(get, set, 0);
  },

  applyAdjustments: (next) => {
    set({
      past: [...get().past, cloneAdjustments(get().adjustments)],
      future: [],
      adjustments: cloneAdjustments(next),
    });
    scheduleRender(get, set, 0);
  },

  openAutoEnhance: async () => {
    if (!get().image) return;
    autoProfiles = {};
    get().beginGesture(); // snapshot current edits → one undo step for the session
    set({
      section: "editor",
      autoEnhance: {
        open: true,
        mode: "natural",
        strength: 100,
        loading: true,
        error: null,
        notes: [],
        scene: null,
      },
    });
    await applyAuto(get, set, "natural", 100);
  },

  setAutoMode: (mode) => {
    if (!get().autoEnhance.open) return;
    void applyAuto(get, set, mode, get().autoEnhance.strength);
  },

  setAutoStrength: (strength) => {
    if (!get().autoEnhance.open) return;
    void applyAuto(get, set, get().autoEnhance.mode, strength);
  },

  applyAutoEnhance: () => {
    get().endGesture(); // commits the session as a single undoable step
    set({ autoEnhance: { ...get().autoEnhance, open: false } });
  },

  cancelAutoEnhance: () => {
    get().cancelGesture();
    set({ autoEnhance: { ...get().autoEnhance, open: false } });
  },

  openPortrait: async () => {
    const { image } = get();
    if (!image) return;
    get().beginGesture(); // whole portrait session = one undo step
    set({
      section: "editor",
      portrait: { ...get().portrait, open: true, detecting: true, message: null },
    });
    if (get().portrait.modes.length === 0) {
      try {
        const modes = await api.portraitModes();
        set({ portrait: { ...get().portrait, modes } });
      } catch {
        /* non-fatal */
      }
    }
    try {
      const res = await api.detectFaces(image.id);
      set({
        portrait: {
          ...get().portrait,
          detecting: false,
          faceCount: res.count,
          modelAvailable: res.model_available,
          message: res.message ?? (res.count === 0 ? "No faces detected in this photo." : null),
        },
      });
      if (res.count > 0) get().setPortraitMode(get().portrait.mode || "natural");
    } catch (e) {
      set({
        portrait: {
          ...get().portrait,
          detecting: false,
          message: e instanceof ApiError ? e.message : "Face detection failed",
        },
      });
    }
  },

  setPortraitMode: (mode) => {
    const m = get().portrait.modes.find((x) => x.id === mode);
    if (!m) return;
    const next = cloneAdjustments(get().adjustments);
    next.portrait = { ...m.params, enabled: true };
    set({ adjustments: next, portrait: { ...get().portrait, mode } });
    scheduleRender(get, set, 0);
  },

  setPortraitField: (field, value) => {
    const next = cloneAdjustments(get().adjustments);
    (next.portrait as unknown as Record<string, number | boolean>)[field] = value;
    next.portrait.enabled = true;
    set({ adjustments: next });
    scheduleRender(get, set);
  },

  applyPortrait: () => {
    get().endGesture();
    set({ portrait: { ...get().portrait, open: false } });
  },

  cancelPortrait: () => {
    get().cancelGesture();
    set({ portrait: { ...get().portrait, open: false } });
  },

  // ---- masking engine (Phase 4) ----
  openMaskPanel: () => set({ section: "editor", maskPanel: { ...get().maskPanel, open: true } }),
  closeMaskPanel: () => set({ maskPanel: { ...get().maskPanel, open: false } }),

  addMask: (type) => {
    if (!get().image) return;
    const cur = get().adjustments;
    const mask = makeMask(type, cur.masks.length + 1);
    const next = cloneAdjustments(cur);
    next.masks = [...next.masks, mask];
    set({
      section: "editor",
      past: [...get().past, cloneAdjustments(cur)],
      future: [],
      adjustments: next,
      maskPanel: { open: true, activeId: mask.id },
    });
    scheduleRender(get, set, 0);
  },

  removeMask: (id) => {
    const cur = get().adjustments;
    if (!cur.masks.some((m) => m.id === id)) return;
    const next = cloneAdjustments(cur);
    next.masks = next.masks.filter((m) => m.id !== id);
    const activeId =
      get().maskPanel.activeId === id
        ? next.masks[next.masks.length - 1]?.id ?? null
        : get().maskPanel.activeId;
    set({
      past: [...get().past, cloneAdjustments(cur)],
      future: [],
      adjustments: next,
      maskPanel: { ...get().maskPanel, activeId },
    });
    scheduleRender(get, set, 0);
  },

  selectMask: (id) => set({ maskPanel: { ...get().maskPanel, activeId: id } }),

  setMaskField: (id, field, value) => {
    const next = cloneAdjustments(get().adjustments);
    const m = next.masks.find((x) => x.id === id);
    if (!m) return;
    (m as unknown as Record<string, number | boolean>)[field] = value;
    set({ adjustments: next });
    scheduleRender(get, set);
  },

  setMaskLocal: (id, field, value) => {
    const next = cloneAdjustments(get().adjustments);
    const m = next.masks.find((x) => x.id === id);
    if (!m) return;
    (m.local as unknown as Record<string, number>)[field] = value;
    set({ adjustments: next });
    scheduleRender(get, set);
  },

  // ---- motion & lens effects (Phase 5) ----
  setMotionField: (field, value) => {
    const next = cloneAdjustments(get().adjustments);
    (next.motion as unknown as Record<string, number | string>)[field] = value;
    set({ adjustments: next });
    scheduleRender(get, set, field === "type" ? 0 : 110);
  },

  // ---- AI Color Match (Phase 7) ----
  openColorMatch: async () => {
    const { image } = get();
    if (!image) return;
    get().beginGesture(); // whole Color Match session = one undo step
    colorMatchBase = cloneAdjustments(get().adjustments);
    set({
      section: "editor",
      colorMatch: {
        open: true, loading: true, error: null, cards: [], scene: null,
        activeCardId: null, intensity: 100,
      },
    });
    try {
      const res = await api.colorMatch(image.id);
      if (!get().colorMatch.open) return; // closed while fetching
      const first = res.cards[0];
      set({
        colorMatch: {
          ...get().colorMatch,
          loading: false,
          cards: res.cards,
          scene: res.scene,
          activeCardId: first?.id ?? null,
        },
      });
      if (first) applyColorCard(get, set, first, 100);
    } catch (e) {
      set({
        colorMatch: {
          ...get().colorMatch,
          loading: false,
          error: e instanceof ApiError ? e.message : "Color Match failed",
        },
      });
    }
  },

  selectColorMatchCard: (id) => {
    const card = get().colorMatch.cards.find((c) => c.id === id);
    if (!card) return;
    set({ colorMatch: { ...get().colorMatch, activeCardId: id } });
    applyColorCard(get, set, card, get().colorMatch.intensity);
  },

  setColorMatchIntensity: (v) => {
    set({ colorMatch: { ...get().colorMatch, intensity: v } });
    const { cards, activeCardId } = get().colorMatch;
    const card = cards.find((c) => c.id === activeCardId);
    if (card) applyColorCard(get, set, card, v);
  },

  applyColorMatch: () => {
    get().endGesture();
    colorMatchBase = null;
    set({ colorMatch: { ...get().colorMatch, open: false } });
  },

  cancelColorMatch: () => {
    get().cancelGesture();
    colorMatchBase = null;
    set({ colorMatch: { ...get().colorMatch, open: false } });
  },

  setGradeLive: (grade) => {
    set({ adjustments: { ...get().adjustments, grade } });
    scheduleRender(get, set);
  },

  resetGrade: () => {
    const next = cloneAdjustments(get().adjustments);
    next.grade = neutralGrade();
    get().applyAdjustments(next);
  },

  loadLuts: async () => {
    try {
      set({ luts: await api.listLuts() });
    } catch {
      /* non-fatal */
    }
  },

  importLut: async () => {
    set({ lutError: null });
    try {
      const file = await pickFile(".cube");
      if (!file) return;
      const info = await api.importLut(file);
      await get().loadLuts();
      get().selectLut(info.id);
    } catch (e) {
      set({ lutError: e instanceof ApiError ? e.message : "LUT import failed" });
    }
  },

  selectLut: (id) => {
    const next = cloneAdjustments(get().adjustments);
    next.grade.lut_id = id;
    get().applyAdjustments(next);
  },

  deleteLut: async (id) => {
    try {
      await api.removeLut(id);
    } catch {
      /* ignore */
    }
    if (get().adjustments.grade.lut_id === id) get().selectLut(null);
    await get().loadLuts();
  },

  exportLut: async () => {
    const { image, adjustments } = get();
    if (!image) return;
    set({ exportState: { state: "exporting" } });
    try {
      if (isTauri()) {
        const path = await pickSavePath("lumetta.cube", "cube");
        if (!path) {
          set({ exportState: { state: "idle" } });
          return;
        }
        const res = await api.exportLutToPath(image.id, adjustments, path);
        set({ exportState: { state: "done", message: `Saved LUT → ${res.path}` } });
      } else {
        const blob = await api.exportLutBytes(image.id, adjustments);
        downloadBlob(blob, "lumetta.cube");
        set({ exportState: { state: "done", message: "Downloaded lumetta.cube" } });
      }
    } catch (e) {
      set({
        exportState: {
          state: "error",
          message: e instanceof ApiError ? e.message : "LUT export failed",
        },
      });
    }
  },

  undo: () => {
    const { past, future, adjustments } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [cloneAdjustments(adjustments), ...future],
      adjustments: cloneAdjustments(prev),
    });
    scheduleRender(get, set, 0);
  },

  redo: () => {
    const { past, future, adjustments } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      past: [...past, cloneAdjustments(adjustments)],
      future: future.slice(1),
      adjustments: cloneAdjustments(next),
    });
    scheduleRender(get, set, 0);
  },

  reset: () => {
    if (isNeutral(get().adjustments)) return;
    get().applyAdjustments(neutralAdjustments());
  },

  setCompare: (m) => set({ compare: m }),
  setSplitPos: (p) => set({ splitPos: Math.min(1, Math.max(0, p)) }),
  setShowOriginal: (b) => set({ showOriginal: b }),
  setZoom: (z, fit = false) => set({ zoom: Math.min(8, Math.max(0.05, z)), fitToScreen: fit }),
  setPreviewQuality: (q) => {
    set({ previewQuality: q });
    if (get().image) scheduleRender(get, set, 0);
  },

  exportImage: async ({ format, quality, resizeLongEdge }) => {
    const { image, adjustments } = get();
    if (!image) return;
    set({ exportState: { state: "exporting" } });
    try {
      const baseName = (image.filename.replace(/\.[^.]+$/, "") || "image") + "_lumetta";
      if (isTauri()) {
        const path = await pickSavePath(`${baseName}.${format}`, format);
        if (!path) {
          set({ exportState: { state: "idle" } });
          return;
        }
        const res = await api.exportToPath(image.id, {
          path,
          format,
          quality,
          resize_long_edge: resizeLongEdge ?? null,
          keep_metadata: true,
          embed_srgb_profile: true,
          adjustments,
        });
        set({
          exportState: {
            state: "done",
            message: `Saved ${res.width}×${res.height} → ${res.path}`,
          },
        });
      } else {
        const blob = await api.exportBytes(
          image.id,
          adjustments,
          format,
          quality,
          resizeLongEdge ?? null,
        );
        downloadBlob(blob, `${baseName}.${format}`);
        set({ exportState: { state: "done", message: `Downloaded ${baseName}.${format}` } });
      }
    } catch (e) {
      set({
        exportState: {
          state: "error",
          message: e instanceof ApiError ? e.message : "Export failed",
        },
      });
    }
  },
}));

// Dev-only: expose the store for manual/automated integration testing.
if ((import.meta as any).env?.DEV) {
  (globalThis as any).__LF_STORE__ = useEditor;
}
