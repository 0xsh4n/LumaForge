import { useEditor } from "../store/editorStore";
import { IconImport, IconSliders, IconLayers, IconExport, IconSparkles } from "../components/icons";

const PHASE1 = [
  { icon: IconImport, title: "Universal import", body: "JPEG, PNG, WebP, TIFF, HEIC and camera RAW — decoded to full-resolution float." },
  { icon: IconSliders, title: "Manual editing engine", body: "Light, Color, Detail and Effects — real, non-destructive, parameter-driven processing." },
  { icon: IconLayers, title: "Non-destructive pipeline", body: "Your original is never touched. Every edit is re-derived from the source on demand." },
  { icon: IconExport, title: "High-quality export", body: "Full-resolution JPEG, PNG, WebP or 16-bit TIFF with sRGB profile and metadata." },
];

const SHIPPED = [
  ["Phase 2", "AI Auto Enhance"],
  ["Phase 2b", "Color Grading"],
  ["Phase 2c", "RAW Development"],
  ["Phase 3", "Portrait Studio"],
  ["Phase 4", "Masks & local edits"],
  ["Phase 5", "Motion Blur"],
];

const ROADMAP = [
  ["Phase 4+", "AI subject / sky masks"],
  ["Phase 5+", "Depth & bokeh"],
  ["Phase 6", "Upscaling & restoration"],
  ["Phase 7", "Color Match · Luma Assistant"],
];

export default function HomeSection() {
  const importImage = useEditor((s) => s.importImage);
  const importing = useEditor((s) => s.importing);
  const backend = useEditor((s) => s.backend);
  const setSection = useEditor((s) => s.setSection);

  return (
    <div className="lf-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-14">
        {/* hero */}
        <div className="lf-fade flex flex-col items-start">
          <div className="mb-5 flex items-center gap-3">
            <Logo />
            <div>
              <div className="text-3xl font-semibold tracking-tight text-mist-100">
                Luma<span className="text-forge-500">Forge</span>
              </div>
              <div className="text-sm text-mist-500">
                AI photo enhancement & DSLR conversion studio
              </div>
            </div>
          </div>
          <p className="max-w-xl text-[15px] leading-relaxed text-mist-400">
            Turn ordinary photographs into professionally processed images — locally,
            offline, on your own hardware. Start by importing a photo.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => void importImage()}
              disabled={importing}
              className="lf-btn-primary px-5 py-2.5 text-[15px]"
            >
              <IconImport width={18} height={18} />
              {importing ? "Opening…" : "Import a photograph"}
            </button>
            <BackendPill status={backend.status} />
          </div>
        </div>

        {/* shipped (phases 2–3) */}
        <div className="mt-10">
          <SectionLabel>Also in this build</SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {SHIPPED.map(([phase, name]) => (
              <div
                key={phase}
                className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2"
              >
                <span className="rounded bg-teal/15 px-1.5 py-0.5 text-[10px] font-medium text-teal">
                  {phase}
                </span>
                <span className="text-[13px] text-mist-300">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* phase 1 features */}
        <div className="mt-10">
          <SectionLabel>Core engine · Phase 1</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PHASE1.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="lf-card flex gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
                    <Icon width={18} height={18} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-mist-100">{f.title}</div>
                    <div className="mt-0.5 text-[13px] leading-relaxed text-mist-500">{f.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* roadmap */}
        <div className="mt-10">
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <IconSparkles width={14} height={14} /> Coming next
            </span>
          </SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {ROADMAP.map(([phase, name]) => (
              <div
                key={phase}
                className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2"
              >
                <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-mist-500">
                  {phase}
                </span>
                <span className="text-[13px] text-mist-300">{name}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-mist-500">
            These features use optional AI models. Download and manage them from{" "}
            <button
              onClick={() => setSection("settings")}
              className="text-forge-400 underline-offset-2 hover:underline"
            >
              Settings → AI models
            </button>
            . Everything runs locally and offline; nothing is required for manual editing.
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-widest text-mist-500">
      {children}
    </div>
  );
}

function BackendPill({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    online: { c: "bg-teal", t: "Engine online" },
    connecting: { c: "bg-forge-500", t: "Connecting…" },
    offline: { c: "bg-ember", t: "Engine offline" },
  };
  const s = map[status] || map.offline;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-mist-400">
      <span className={`h-2 w-2 rounded-full ${s.c} ${status === "connecting" ? "animate-pulse" : ""}`} />
      {s.t}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-forge-400 to-forge-700 shadow-pop">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0a0b0d" strokeWidth="2">
        <circle cx="12" cy="12" r="4.2" strokeLinecap="round" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
