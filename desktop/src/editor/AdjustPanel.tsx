import { useMemo, useState } from "react";
import { EDITOR_GROUPS } from "../lib/adjustments";
import type { SliderSpec } from "../lib/adjustments";
import type { AdjustGroup } from "../types";
import Slider from "../components/Slider";
import Histogram from "../components/Histogram";
import ColorStudioPanel from "./ColorStudioPanel";
import RawDevelopPanel from "./RawDevelopPanel";
import { useEditor } from "../store/editorStore";

export default function AdjustPanel() {
  const analysis = useEditor((s) => s.analysis);
  const image = useEditor((s) => s.image);
  const [tab, setTab] = useState<"basic" | "color">("basic");
  const [open, setOpen] = useState<Record<string, boolean>>({
    light: true,
    color: true,
    detail: true,
    effects: false,
  });

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-ink-600 bg-ink-800">
      {/* RAW develop (only for RAW images) */}
      <RawDevelopPanel />
      {/* histogram + readout */}
      <div className="border-b border-ink-600 p-3">
        <Histogram data={analysis?.histogram ?? null} />
        {analysis && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-mist-500">
            <span className={analysis.black_clip_pct > 1 ? "text-ember" : ""}>
              ▼ {analysis.black_clip_pct.toFixed(1)}%
            </span>
            <span>
              {image ? `${image.width}×${image.height} · ${image.megapixels}MP` : ""}
            </span>
            <span className={analysis.white_clip_pct > 1 ? "text-ember" : ""}>
              {analysis.white_clip_pct.toFixed(1)}% ▲
            </span>
          </div>
        )}
      </div>

      {/* Basic / Color tab switcher */}
      <div className="flex gap-1 border-b border-ink-600 p-2">
        {(["basic", "color"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? "bg-ink-600 text-mist-100" : "text-mist-500 hover:bg-ink-700"
            }`}
          >
            {t === "color" ? "Color Studio" : "Basic"}
          </button>
        ))}
      </div>

      {tab === "color" ? (
        <ColorStudioPanel />
      ) : (
        <div className="lf-scroll flex-1 overflow-y-auto">
        {EDITOR_GROUPS.map((g) => (
          <GroupPanel
            key={g.group}
            title={g.title}
            isOpen={!!open[g.group]}
            toggle={() => setOpen((o) => ({ ...o, [g.group]: !o[g.group] }))}
          >
            <GroupBody group={g.group} sliders={g.sliders} />
          </GroupPanel>
          ))}
          <div className="h-4" />
        </div>
      )}
    </aside>
  );
}

function GroupPanel({
  title,
  isOpen,
  toggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  toggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-ink-600/70">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[13px] font-semibold uppercase tracking-wider text-mist-300">
          {title}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-mist-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && <div className="px-4 pb-3 lf-fade">{children}</div>}
    </section>
  );
}

function GroupBody({ group, sliders }: { group: AdjustGroup; sliders: SliderSpec[] }) {
  // group sliders by optional sub-heading (e.g. Sharpening / Presence / Noise)
  const sections = useMemo(() => {
    const result: { sub: string; items: SliderSpec[] }[] = [];
    for (const spec of sliders) {
      const sub = spec.sub || "";
      const last = result[result.length - 1];
      if (last && last.sub === sub) last.items.push(spec);
      else result.push({ sub, items: [spec] });
    }
    return result;
  }, [sliders]);

  return (
    <div>
      {sections.map(({ sub, items }, i) => (
        <div key={sub || i} className="mb-1">
          {sub && (
            <div className="mb-1 mt-2 text-[11px] font-medium uppercase tracking-wide text-mist-500">
              {sub}
            </div>
          )}
          {items.map((spec) => (
            <Slider key={spec.key} group={group} spec={spec} />
          ))}
        </div>
      ))}
    </div>
  );
}
