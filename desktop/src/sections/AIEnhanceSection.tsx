import { useEditor } from "../store/editorStore";
import { IconWand, IconFace, IconSubject, IconSparkles, IconImport } from "../components/icons";

const FEATURES = [
  {
    icon: IconFace,
    name: "AI Portrait Retouch",
    phase: 3,
    body: "Face-aware blemish reduction, skin-texture-preserving smoothing, eye and teeth refinement — identity and facial geometry always preserved.",
  },
  {
    icon: IconSubject,
    name: "DSLR Look",
    phase: 5,
    body: "Subject separation, natural background blur and lens-character rendering (35/50/85/135mm) to give phone photos a professional camera feel.",
  },
  {
    icon: IconSparkles,
    name: "Upscaling & Restoration",
    phase: 6,
    body: "Real-ESRGAN 2×/4× upscaling and detail restoration with VRAM-aware tiled inference for 4 GB GPUs.",
  },
];

export default function AIEnhanceSection() {
  const analysis = useEditor((s) => s.analysis);
  const image = useEditor((s) => s.image);
  const importImage = useEditor((s) => s.importImage);
  const openAutoEnhance = useEditor((s) => s.openAutoEnhance);

  return (
    <div className="lf-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <h1 className="text-2xl font-semibold text-mist-100">AI Enhancement</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist-500">
          LumaForge's AI features run entirely on your machine using local models. They
          build on the same image-analysis engine already working in Phase 1 — shown below
          for the current photo.
        </p>

        {/* Real Phase-1 analysis */}
        <section className="mt-6 lf-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-mist-400">
            Image analysis
          </h2>
          {!image ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-mist-500">Import a photo to analyze it.</span>
              <button onClick={() => void importImage()} className="lf-btn-subtle">
                <IconImport width={16} height={16} /> Import
              </button>
            </div>
          ) : !analysis ? (
            <p className="text-sm text-mist-500">Analyzing…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Mean brightness" value={`${(analysis.mean_luma * 100).toFixed(0)}%`} />
              <Stat label="Contrast (σ)" value={analysis.contrast_std.toFixed(3)} />
              <Stat label="Sharpness" value={analysis.sharpness.toFixed(0)} />
              <Stat
                label="Shadow clipping"
                value={`${analysis.black_clip_pct.toFixed(1)}%`}
                warn={analysis.black_clip_pct > 1}
              />
              <Stat
                label="Highlight clipping"
                value={`${analysis.white_clip_pct.toFixed(1)}%`}
                warn={analysis.white_clip_pct > 1}
              />
              <Stat
                label="Color cast"
                value={
                  Math.abs(analysis.estimated_temp_bias) < 3
                    ? "neutral"
                    : analysis.estimated_temp_bias > 0
                    ? "warm"
                    : "cool"
                }
              />
            </div>
          )}
        </section>

        {/* Auto Enhance — live */}
        <section className="mt-6 lf-card relative overflow-hidden p-5">
          <span className="absolute right-4 top-4 rounded bg-forge-500/20 px-2 py-0.5 text-[11px] font-medium text-forge-300">
            Available
          </span>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
            <IconWand width={20} height={20} />
          </div>
          <div className="text-base font-medium text-mist-100">AI Auto Enhance</div>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-mist-500">
            Analyzes exposure, white balance, contrast and dynamic range to generate an
            adaptive, per-image enhancement profile — Natural, Professional or Cinematic.
            Every value lands in the editor and stays fully editable.
          </p>
          <button
            onClick={() => void openAutoEnhance()}
            disabled={!image}
            className="lf-btn-primary mt-4 disabled:opacity-50"
          >
            <IconWand width={16} height={16} />
            {image ? "Open Auto Enhance" : "Import a photo first"}
          </button>
        </section>

        {/* Roadmap */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.name} className="relative lf-card p-5">
                <span className="absolute right-4 top-4 rounded bg-ink-700 px-2 py-0.5 text-[11px] font-medium text-mist-500">
                  Phase {f.phase}
                </span>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
                  <Icon width={20} height={20} />
                </div>
                <div className="text-base font-medium text-mist-100">{f.name}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mist-500">{f.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-850 p-3">
      <div className="text-[11px] uppercase tracking-wide text-mist-500">{label}</div>
      <div className={`mt-1 font-mono text-lg ${warn ? "text-ember" : "text-mist-100"}`}>
        {value}
      </div>
    </div>
  );
}
