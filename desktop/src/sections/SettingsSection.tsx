import { useEffect } from "react";
import { useEditor } from "../store/editorStore";
import type { PreviewQuality } from "../store/editorStore";
import type { ModelInfo } from "../types";
import { openExternal } from "../lib/platform";
import { IconChip, IconCheck, IconAlert, IconExport, IconLayers } from "../components/icons";

export default function SettingsSection() {
  const hardware = useEditor((s) => s.hardware);
  const loadHardware = useEditor((s) => s.loadHardware);
  const backend = useEditor((s) => s.backend);
  const previewQuality = useEditor((s) => s.previewQuality);
  const setPreviewQuality = useEditor((s) => s.setPreviewQuality);
  const loadModels = useEditor((s) => s.loadModels);

  useEffect(() => {
    void loadHardware();
    void loadModels();
  }, [loadHardware, loadModels]);

  return (
    <div className="lf-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="text-2xl font-semibold text-mist-100">Settings</h1>
        <p className="mt-1 text-sm text-mist-500">
          Hardware compatibility, performance and application preferences.
        </p>

        {/* Compatibility report */}
        <Card title="Hardware compatibility">
          {!hardware ? (
            <p className="text-sm text-mist-500">Reading hardware…</p>
          ) : (
            <div className="space-y-4">
              <Row label="Operating system">
                {hardware.os.system} {hardware.os.release} · {hardware.os.machine}
              </Row>
              <Row label="Processor">
                {hardware.cpu.processor} · {hardware.cpu.cores_logical} logical cores
              </Row>
              <Row label="Libraries">
                OpenCV {hardware.cpu.opencv_version} · NumPy {hardware.cpu.numpy_version} ·
                Python {hardware.os.python}
              </Row>

              <div className="border-t border-ink-600 pt-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-mist-200">
                  <IconChip width={16} height={16} /> GPU acceleration
                </div>
                {hardware.gpus.length === 0 ? (
                  <Badge ok={false}>
                    No NVIDIA GPU detected — all processing runs on the CPU.
                  </Badge>
                ) : (
                  hardware.gpus.map((g, i) => (
                    <div key={i} className="mb-2 rounded-lg border border-ink-600 bg-ink-850 p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-mist-200">{g.name}</span>
                        <span className="text-xs text-mist-500">driver {g.driver_version}</span>
                      </div>
                      <VramBar total={g.vram_total_mb} used={g.vram_used_mb} />
                    </div>
                  ))
                )}
                <div className="mt-2">
                  <Badge ok={hardware.cuda_available}>
                    CUDA runtime {hardware.cuda_available ? "available" : "not installed"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-mist-500">
                  {hardware.gpu_acceleration_note}
                </p>
              </div>

              <div className="border-t border-ink-600 pt-4">
                <div className="mb-2 text-sm font-medium text-mist-200">Supported formats</div>
                <div className="flex flex-wrap gap-1.5">
                  {hardware.formats.all_importable.map((e) => (
                    <span key={e} className="rounded bg-ink-700 px-2 py-0.5 text-[11px] font-mono text-mist-300">
                      {e}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-4 text-xs text-mist-500">
                  <span className="flex items-center gap-1">
                    {hardware.formats.heif_available ? <Dot ok /> : <Dot />} HEIC/HEIF
                  </span>
                  <span className="flex items-center gap-1">
                    {hardware.formats.raw_available ? <Dot ok /> : <Dot />} Camera RAW
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Performance */}
        <Card title="Preview quality">
          <p className="mb-3 text-sm text-mist-500">
            Higher quality previews are sharper but take longer to render while you
            adjust sliders. Exports always use full resolution regardless of this setting.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["draft", "standard", "high"] as PreviewQuality[]).map((q) => (
              <button
                key={q}
                onClick={() => setPreviewQuality(q)}
                className={`rounded-lg border px-3 py-2.5 text-sm capitalize transition-colors ${
                  previewQuality === q
                    ? "border-forge-500 bg-forge-500/10 text-forge-300"
                    : "border-ink-600 bg-ink-850 text-mist-300 hover:border-ink-500"
                }`}
              >
                {q}
                <span className="mt-0.5 block text-[11px] text-mist-500">
                  {q === "draft" ? "1024px" : q === "standard" ? "1400px" : "1920px"}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* AI model manager */}
        <ModelManager />

        <Card title="About">
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist-300">Lumetta</span>
            <span className="font-mono text-mist-500">
              v{backend.version ?? "—"} · backend {backend.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-mist-500">
            Local, offline photo enhancement studio. No cloud services, no subscriptions.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 lf-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-mist-500">{label}</span>
      <span className="text-right text-mist-200">{children}</span>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
        ok ? "bg-teal/15 text-teal" : "bg-ink-700 text-mist-400"
      }`}
    >
      {ok ? <IconCheck width={13} height={13} /> : <IconAlert width={13} height={13} />}
      {children}
    </span>
  );
}

function Dot({ ok }: { ok?: boolean }) {
  return <span className={`h-2 w-2 rounded-full ${ok ? "bg-teal" : "bg-ink-500"}`} />;
}

function VramBar({ total, used }: { total: number; used: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-[11px] text-mist-500">
        <span>VRAM</span>
        <span className="font-mono">
          {(used / 1024).toFixed(1)} / {(total / 1024).toFixed(1)} GB
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
        <div className="h-full rounded-full bg-forge-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ---- Model Manager --------------------------------------------------------

// Human category labels for the model groups (keyed by the registry phase,
// which only drives ordering — the number is never surfaced to users).
const MODEL_CATEGORY: Record<number, string> = {
  3: "Face detection",
  4: "Masking & segmentation",
  5: "Depth & bokeh",
  6: "Upscaling & restoration",
  7: "Restoration & assistant",
};

function ModelManager() {
  const models = useEditor((s) => s.models);
  const storage = useEditor((s) => s.modelStorage);
  const loading = useEditor((s) => s.modelsLoading);
  const error = useEditor((s) => s.modelError);
  const download = useEditor((s) => s.downloadModel);
  const remove = useEditor((s) => s.removeModel);

  // Group models by a human category (ordered by the registry's phase field,
  // but the number is never shown).
  const groups = Array.from(new Set(models.map((m) => m.phase)))
    .sort((a, b) => a - b)
    .map((phase) => ({ phase, label: MODEL_CATEGORY[phase] ?? "Other models" }));

  return (
    <Card title="AI models">
      <p className="text-sm text-mist-500">
        Lumetta's AI extras — masking, depth &amp; bokeh, upscaling, face restoration and
        the optional Lumetta Assistant — use the models below. They are optional and
        downloaded on demand from their official sources; none are needed for manual
        editing, Auto Enhance, Color Match, color grading or RAW development.
      </p>

      {storage && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-ink-600 bg-ink-850 p-3">
          <IconLayers width={16} height={16} className="mt-0.5 shrink-0 text-mist-500" />
          <div className="min-w-0 text-[13px]">
            <div className="text-mist-300">
              Stored in{" "}
              <code className="break-all font-mono text-[12px] text-mist-400">
                {storage.dir}
              </code>
            </div>
            <div className="mt-0.5 text-mist-500">
              {storage.installed_count} installed · {storage.total_human} on disk
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-ember/40 bg-ember/10 px-3 py-2 text-[13px] text-mist-200">
          <IconAlert width={14} height={14} className="mt-0.5 shrink-0 text-ember" />
          <span>{error}</span>
        </div>
      )}

      {loading && models.length === 0 ? (
        <p className="mt-3 text-sm text-mist-500">Loading models…</p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map(({ phase, label }) => (
            <div key={phase}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-mist-500">
                {label}
              </div>
              <div className="space-y-2">
                {models
                  .filter((m) => m.phase === phase)
                  .map((m) => (
                    <ModelRow
                      key={m.id}
                      m={m}
                      onDownload={() => void download(m.id)}
                      onRemove={() => void remove(m.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function sizeLabel(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb < 1) return "<1 MB";
  return `${Math.round(mb)} MB`;
}

function ModelRow({
  m,
  onDownload,
  onRemove,
}: {
  m: ModelInfo;
  onDownload: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-850 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-mist-100">{m.name}</span>
            {m.installed && (
              <span className="inline-flex items-center gap-1 rounded bg-teal/15 px-1.5 py-0.5 text-[10px] text-teal">
                <IconCheck width={10} height={10} /> Installed
              </span>
            )}
            {m.kind === "vlm" && (
              <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-mist-500">VLM</span>
            )}
          </div>
          <div className="mt-0.5 text-[13px] leading-relaxed text-mist-500">{m.feature}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-mist-600">
            <span>{sizeLabel(m.size_mb)}</span>
            <span>·</span>
            <span>{m.license}</span>
            {m.min_vram_mb > 0 && (
              <>
                <span>·</span>
                <span>~{(m.min_vram_mb / 1024).toFixed(1)} GB VRAM or CPU</span>
              </>
            )}
          </div>
          {m.note && <div className="mt-1 text-[11px] italic text-mist-600">{m.note}</div>}
        </div>
        <ModelAction m={m} onDownload={onDownload} onRemove={onRemove} />
      </div>
      {m.state === "downloading" && (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[10px] text-mist-500">
            <span>Downloading…</span>
            <span className="font-mono">{m.progress.pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-600">
            <div
              className="h-full rounded-full bg-forge-500 transition-all"
              style={{ width: `${Math.max(3, m.progress.pct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ModelAction({
  m,
  onDownload,
  onRemove,
}: {
  m: ModelInfo;
  onDownload: () => void;
  onRemove: () => void;
}) {
  if (m.installed) {
    return (
      <button
        onClick={onRemove}
        className="shrink-0 rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-mist-400 transition-colors hover:border-ember/50 hover:text-ember"
      >
        Remove
      </button>
    );
  }
  if (m.state === "downloading") {
    return <span className="shrink-0 font-mono text-xs text-forge-300">{m.progress.pct}%</span>;
  }
  // VLMs install via Ollama; large/drifting assets are placed manually. Both
  // link to the official source page rather than auto-downloading.
  if (m.kind === "vlm" || !m.auto_downloadable) {
    return (
      <button
        onClick={() => void openExternal(m.source_page)}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-mist-300 transition-colors hover:border-ink-500"
        title={m.source_page}
      >
        {m.kind === "vlm" ? "Via Ollama" : "Get model"}
        <IconExport width={12} height={12} />
      </button>
    );
  }
  return (
    <button
      onClick={onDownload}
      className="shrink-0 rounded-lg bg-forge-500/15 px-3 py-1.5 text-xs font-medium text-forge-300 transition-colors hover:bg-forge-500/25"
    >
      Download
    </button>
  );
}
