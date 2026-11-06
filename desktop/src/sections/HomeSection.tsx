import { useEffect } from "react";
import { useEditor } from "../store/editorStore";
import {
  IconImport,
  IconSliders,
  IconLayers,
  IconExport,
  IconSparkles,
  IconPresets,
  IconWand,
  IconFace,
  IconGradientRadial,
} from "../components/icons";
import Logo from "../components/Logo";

const CAPABILITIES = [
  { icon: IconWand, title: "AI Auto Enhance", body: "One click reads the scene and balances exposure, colour and contrast — every value stays editable." },
  { icon: IconSparkles, title: "AI Color Match", body: "Adjustable cinematic grading looks, matched to your photo, with skin tones protected." },
  { icon: IconFace, title: "Portrait Studio", body: "Natural, identity-preserving retouch — skin, eyes, teeth and hair — inside face-aware masks." },
  { icon: IconSliders, title: "Precision editing", body: "Light, colour, detail and effects: real, non-destructive, parameter-driven controls." },
  { icon: IconLayers, title: "Masks & local edits", body: "Linear, radial and brush masks with per-area adjustments and selective blur." },
  { icon: IconGradientRadial, title: "Color grading", body: "Tone curves, HSL, colour wheels, split toning and .cube LUT import & export." },
  { icon: IconImport, title: "RAW & universal import", body: "Develop camera RAW/DNG and open JPEG, PNG, WebP, TIFF and HEIC at full resolution." },
  { icon: IconExport, title: "High-quality export", body: "Full-resolution JPEG, PNG, WebP or 16-bit TIFF with sRGB profile and metadata." },
];

const COMING_SOON = [
  "AI subject & sky masks",
  "Depth-based bokeh",
  "AI upscaling & restoration",
  "Lumetta Assistant",
];

export default function HomeSection() {
  const importImage = useEditor((s) => s.importImage);
  const importing = useEditor((s) => s.importing);
  const backend = useEditor((s) => s.backend);
  const setSection = useEditor((s) => s.setSection);
  const recentProjects = useEditor((s) => s.recentProjects);
  const loadRecentProjects = useEditor((s) => s.loadRecentProjects);
  const openProjectDialog = useEditor((s) => s.openProjectDialog);
  const openProjectPath = useEditor((s) => s.openProjectPath);

  useEffect(() => {
    void loadRecentProjects();
  }, [loadRecentProjects]);

  return (
    <div className="lf-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-14">
        {/* hero */}
        <div className="lf-fade flex flex-col items-start">
          <div className="mb-5 flex items-center gap-3">
            <Logo />
            <div>
              <div className="text-3xl font-semibold tracking-tight text-mist-100">
                Lum<span className="text-forge-500">etta</span>
              </div>
              <div className="text-sm text-mist-500">
                AI photo enhancement &amp; DSLR conversion studio
              </div>
            </div>
          </div>
          <p className="max-w-xl text-[15px] leading-relaxed text-mist-400">
            Turn ordinary photographs into professionally processed images — fully
            offline, on your own hardware. Every edit is non-destructive and your
            original is never touched.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void importImage()}
              disabled={importing}
              className="lf-btn-primary px-5 py-2.5 text-[15px]"
            >
              <IconImport width={18} height={18} />
              {importing ? "Opening…" : "Import a photograph"}
            </button>
            <button
              onClick={() => void openProjectDialog()}
              className="lf-btn-subtle px-4 py-2.5 text-[14px]"
              title="Open a saved .lfp project"
            >
              <IconPresets width={16} height={16} /> Open project
            </button>
            <BackendPill status={backend.status} />
          </div>
        </div>

        {/* recent projects */}
        {recentProjects.length > 0 && (
          <div className="mt-12">
            <SectionLabel>Recent projects</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {recentProjects.slice(0, 6).map((p) => (
                <button
                  key={p.path}
                  onClick={() => void openProjectPath(p.path)}
                  className="lf-card flex items-center gap-3 p-3 text-left transition-colors hover:border-forge-500/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-700 text-mist-400">
                    <IconPresets width={16} height={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-mist-100">{p.name}</div>
                    <div className="truncate text-[11px] text-mist-500">{p.path}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* capabilities */}
        <div className="mt-12">
          <SectionLabel>Everything in the studio</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CAPABILITIES.map((f) => {
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

        {/* coming soon */}
        <div className="mt-12">
          <SectionLabel>
            <span className="inline-flex items-center gap-1.5">
              <IconSparkles width={14} height={14} /> Coming soon
            </span>
          </SectionLabel>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMING_SOON.map((name) => (
              <span
                key={name}
                className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-[13px] text-mist-300"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-mist-500">
            These use optional AI models you can add from{" "}
            <button
              onClick={() => setSection("settings")}
              className="text-forge-400 underline-offset-2 hover:underline"
            >
              Settings → AI models
            </button>
            . Everything runs locally and offline — nothing is required for manual editing.
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
