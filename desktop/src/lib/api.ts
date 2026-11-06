// Thin typed client for the local Lumetta backend.
import type {
  Adjustments,
  AutoEnhanceResult,
  AutoMode,
  ColorMatchResult,
  ExportFormat,
  ExportResult,
  HardwareReport,
  ImageAnalysis,
  ImageMeta,
  LutInfo,
  ModelInfo,
  ModelListResponse,
  PortraitMode,
  ProjectFile,
  RawParams,
  RecentProject,
} from "../types";

const API_BASE: string =
  (import.meta as any).env?.VITE_LUMETTA_API ||
  (typeof window !== "undefined" && (window as any).__LUMETTA_API__) ||
  "http://127.0.0.1:8756";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

async function blobFetch(path: string, init?: RequestInit, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(API_BASE + path, { ...init, signal });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  return res.blob();
}

export const api = {
  base: API_BASE,

  async installAiExtras(): Promise<{ installed: boolean; message: string }> {
    return jsonFetch("/api/system/ai-extras/install", { method: "POST" });
  },

  async computeDepth(id: string): Promise<{ available: boolean; cached: boolean; provider?: string; message?: string }> {
    return jsonFetch(`/api/images/${id}/depth`, { method: "POST" });
  },

  async assistantSuggest(id: string, text: string, adjustments: Adjustments) {
    return jsonFetch<import("../types").AssistantSuggestion>(`/api/images/${id}/assistant`, {
      method: "POST", body: JSON.stringify({ text, adjustments }),
    });
  },

  async aiJobs(): Promise<{ jobs: { id: string; state: string; progress: number; provider: string | null; message: string }[] }> {
    return jsonFetch("/api/ai/jobs");
  },
  async cancelAiJob(id: string) {
    return jsonFetch(`/api/ai/jobs/${id}/cancel`, { method: "POST" });
  },
  async startUpscale(id: string, scale: 2 | 4) {
    return jsonFetch<{ job_id: string }>(`/api/images/${id}/upscale`, {
      method: "POST", body: JSON.stringify({ scale, model: "realesrgan_x4plus", denoise: false, restore_faces: false }),
    });
  },

  async health(): Promise<{ status: string; version: string }> {
    return jsonFetch("/api/system/health");
  },

  async hardware(): Promise<HardwareReport> {
    return jsonFetch("/api/system/hardware");
  },

  async importPath(path: string): Promise<ImageMeta> {
    return jsonFetch("/api/images/import-path", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
  },
  async imageMeta(id: string): Promise<ImageMeta> { return jsonFetch(`/api/images/${id}`); },

  async importUpload(file: File): Promise<ImageMeta> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(API_BASE + "/api/images/import-upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail || detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    return res.json();
  },

  async analyze(id: string): Promise<ImageAnalysis> {
    return jsonFetch(`/api/images/${id}/analyze`);
  },

  async rawDevelop(id: string, rawParams: RawParams): Promise<ImageMeta> {
    return jsonFetch(`/api/images/${id}/raw-develop`, {
      method: "POST",
      body: JSON.stringify({ raw_params: rawParams }),
    });
  },

  // ---- Portrait Studio (Phase 3) ----
  async detectFaces(id: string): Promise<{
    model_available: boolean;
    count: number;
    faces: { box: number[]; score: number }[];
    message?: string;
  }> {
    return jsonFetch(`/api/images/${id}/detect-faces`, { method: "POST" });
  },

  async computeAiMask(id: string, kind: "subject" | "background" | "sky", model = "birefnet_lite") {
    return jsonFetch<{ available: boolean; cached: boolean; provider?: string; message?: string }>(
      `/api/images/${id}/ai-mask`,
      { method: "POST", body: JSON.stringify({ kind, model }) },
    );
  },

  async portraitModes(): Promise<PortraitMode[]> {
    return jsonFetch("/api/portrait/modes");
  },

  originalUrl(id: string, maxDim = 1600): string {
    return `${API_BASE}/api/images/${id}/original?max_dim=${maxDim}`;
  },

  async render(
    id: string,
    adjustments: Adjustments,
    opts: { maxDim?: number; quality?: number; signal?: AbortSignal } = {},
  ): Promise<Blob> {
    return blobFetch(
      `/api/images/${id}/render`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adjustments,
          max_dim: opts.maxDim ?? null,
          format: "jpeg",
          quality: opts.quality ?? 88,
        }),
      },
      opts.signal,
    );
  },

  async exportToPath(
    id: string,
    req: {
      path: string;
      format: ExportFormat;
      quality: number;
      resize_long_edge?: number | null;
      keep_metadata: boolean;
      embed_srgb_profile: boolean;
      adjustments: Adjustments;
    },
  ): Promise<ExportResult> {
    return jsonFetch(`/api/images/${id}/export`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async exportBytes(
    id: string,
    adjustments: Adjustments,
    format: ExportFormat,
    quality: number,
    resize_long_edge?: number | null,
  ): Promise<Blob> {
    return blobFetch(`/api/images/${id}/export-bytes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "",
        format,
        quality,
        resize_long_edge: resize_long_edge ?? null,
        keep_metadata: true,
        embed_srgb_profile: true,
        adjustments,
      }),
    });
  },

  async autoEnhance(id: string, mode: AutoMode, strength: number): Promise<AutoEnhanceResult> {
    return jsonFetch(`/api/images/${id}/auto-enhance`, {
      method: "POST",
      body: JSON.stringify({ mode, strength }),
    });
  },

  async colorMatch(id: string): Promise<ColorMatchResult> {
    return jsonFetch(`/api/images/${id}/color-match`, { method: "POST" });
  },

  // ---- Color grading / LUTs (Phase 2b) ----
  async listLuts(): Promise<LutInfo[]> {
    return jsonFetch("/api/luts");
  },

  async importLut(file: File): Promise<LutInfo> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(API_BASE + "/api/luts/import", { method: "POST", body: form });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        detail = (await res.json()).detail || detail;
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, detail);
    }
    return res.json();
  },

  async removeLut(id: string): Promise<void> {
    await jsonFetch(`/api/luts/${id}`, { method: "DELETE" });
  },

  async exportLutBytes(id: string, adjustments: Adjustments, size = 33): Promise<Blob> {
    return blobFetch(`/api/images/${id}/export-lut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustments, size }),
    });
  },

  async exportLutToPath(
    id: string,
    adjustments: Adjustments,
    path: string,
    size = 33,
  ): Promise<{ path: string }> {
    return jsonFetch(`/api/images/${id}/export-lut-path`, {
      method: "POST",
      body: JSON.stringify({ adjustments, size, path }),
    });
  },

  // ---- Projects (.lfp save / open / recent) ----
  async recentProjects(): Promise<RecentProject[]> {
    return jsonFetch("/api/projects/recent");
  },

  async saveProject(req: {
    path: string;
    name: string;
    source_path: string | null;
    original_width: number;
    original_height: number;
    adjustments: Adjustments;
    created_at?: string;
  }): Promise<ProjectFile> {
    return jsonFetch("/api/projects/save", { method: "POST", body: JSON.stringify(req) });
  },

  async openProject(path: string): Promise<ProjectFile> {
    return jsonFetch("/api/projects/open", { method: "POST", body: JSON.stringify({ path }) });
  },

  async deleteImage(id: string): Promise<void> {
    try {
      await jsonFetch(`/api/images/${id}`, { method: "DELETE" });
    } catch {
      /* best-effort: backend also LRU-evicts */
    }
  },

  // ---- Model Manager (Phase 7 §25) ----
  async listModels(): Promise<ModelListResponse> {
    return jsonFetch("/api/models");
  },

  async downloadModel(id: string): Promise<ModelInfo> {
    return jsonFetch(`/api/models/${id}/download`, { method: "POST" });
  },

  async removeModel(id: string): Promise<void> {
    await jsonFetch(`/api/models/${id}`, { method: "DELETE" });
  },
};

// Dev-only: expose the client for manual/automated integration testing.
if ((import.meta as any).env?.DEV) {
  (globalThis as any).__LF_API__ = api;
}
