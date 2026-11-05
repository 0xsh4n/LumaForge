// Thin typed client for the local LumaForge backend.
import type {
  Adjustments,
  AutoEnhanceResult,
  AutoMode,
  ExportFormat,
  ExportResult,
  HardwareReport,
  ImageAnalysis,
  ImageMeta,
  LutInfo,
  PortraitMode,
  RawParams,
} from "../types";

const API_BASE: string =
  (import.meta as any).env?.VITE_LUMAFORGE_API ||
  (typeof window !== "undefined" && (window as any).__LUMAFORGE_API__) ||
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

  async recentProjects(): Promise<{ path: string; name: string; opened_at: string }[]> {
    return jsonFetch("/api/projects/recent");
  },
};

// Dev-only: expose the client for manual/automated integration testing.
if ((import.meta as any).env?.DEV) {
  (globalThis as any).__LF_API__ = api;
}
