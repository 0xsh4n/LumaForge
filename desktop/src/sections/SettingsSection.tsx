import { useEffect } from "react";
import { useEditor } from "../store/editorStore";
import type { PreviewQuality } from "../store/editorStore";
import { IconChip, IconCheck, IconAlert } from "../components/icons";

export default function SettingsSection() {
  const hardware = useEditor((s) => s.hardware);
  const loadHardware = useEditor((s) => s.loadHardware);
  const backend = useEditor((s) => s.backend);
  const previewQuality = useEditor((s) => s.previewQuality);
  const setPreviewQuality = useEditor((s) => s.setPreviewQuality);

  useEffect(() => {
    void loadHardware();
  }, [loadHardware]);

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

        {/* AI models (future phases) */}
        <Card title="AI model management">
          <p className="text-sm text-mist-500">
            AI features (Auto Enhance analysis models, face restoration, segmentation,
            upscaling) download their models on demand starting in Phase 2. None are
            required for the manual editing engine.
          </p>
          <div className="mt-3 space-y-1.5">
            {[
              ["Real-ESRGAN (upscaling)", 6],
              ["GFPGAN / CodeFormer (face restoration)", 3],
              ["BiRefNet (subject segmentation)", 4],
              ["MediaPipe (face mesh)", 3],
            ].map(([name, phase]) => (
              <div
                key={name as string}
                className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm"
              >
                <span className="text-mist-300">{name}</span>
                <span className="rounded bg-ink-700 px-2 py-0.5 text-[11px] text-mist-500">
                  Phase {phase}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="About">
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist-300">LumaForge</span>
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
