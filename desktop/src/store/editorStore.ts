import { create } from "zustand";
import { api, ApiError } from "../lib/api";
import {
  cloneAdjustments,
  isNeutral,
  neutralAdjustments,
} from "../lib/adjustments";
import { pickImageToImport, pickSavePath, downloadBlob, isTauri } from "../lib/platform";
import type {
  Adjustments,
  AdjustGroup,
  ExportFormat,
  HardwareReport,
  ImageAnalysis,
  ImageMeta,
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

  // --- actions ---
  setSection: (s: Section) => void;
  initBackend: () => Promise<void>;
  loadHardware: () => Promise<void>;

  importImage: () => Promise<void>;
  openPath: (path: string) => Promise<void>;
  closeImage: () => void;

  beginGesture: () => void;
  setAdjustment: (group: AdjustGroup, key: string, value: number) => void;
  endGesture: () => void;
  applyAdjustments: (next: Adjustments, label?: string) => void;

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

// ---- render scheduler (module scope, outside React) -----------------------
let renderTimer: number | undefined;
let renderSeq = 0;
let inflight: AbortController | null = null;
let gestureSnapshot: Adjustments | null = null;

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

  setSection: (s) => set({ section: s }),

  initBackend: async () => {
    set({ backend: { status: "connecting" } });
    try {
      const h = await api.health();
      set({ backend: { status: "online", version: h.version } });
      void get().loadHardware();
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

  closeImage: () => {
    const prev = get().previewUrl;
    if (prev) URL.revokeObjectURL(prev);
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

  applyAdjustments: (next) => {
    set({
      past: [...get().past, cloneAdjustments(get().adjustments)],
      future: [],
      adjustments: cloneAdjustments(next),
    });
    scheduleRender(get, set, 0);
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
      const baseName = (image.filename.replace(/\.[^.]+$/, "") || "image") + "_lumaforge";
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
