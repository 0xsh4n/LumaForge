import { PRESETS } from "../lib/presets";
import { useEditor } from "../store/editorStore";
import { IconImport } from "../components/icons";

export default function PresetsSection() {
  const image = useEditor((s) => s.image);
  const applyAdjustments = useEditor((s) => s.applyAdjustments);
  const setSection = useEditor((s) => s.setSection);
  const importImage = useEditor((s) => s.importImage);

  const apply = (buildFn: () => ReturnType<typeof PRESETS[number]["build"]>) => {
    applyAdjustments(buildFn());
    setSection("editor");
  };

  return (
    <div className="lf-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <h1 className="text-2xl font-semibold text-mist-100">Presets</h1>
        <p className="mt-1 max-w-2xl text-sm text-mist-500">
          One-click looks built entirely from Lumetta's manual adjustments. Applying a
          preset loads its values into the editor, where you can inspect and fine-tune
          every slider — nothing is hidden or baked in.
        </p>

        {!image && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-dashed border-ink-500 bg-ink-800 px-5 py-4">
            <span className="text-sm text-mist-400">Import a photograph to apply a preset.</span>
            <button onClick={() => void importImage()} className="lf-btn-subtle">
              <IconImport width={16} height={16} /> Import
            </button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              disabled={!image}
              onClick={() => apply(p.build)}
              className="group lf-card overflow-hidden p-0 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <div className="h-24 bg-gradient-to-br from-ink-600 to-ink-850 transition-opacity group-hover:opacity-90" style={presetGradient(p.id)} />
              <div className="p-4">
                <div className="text-sm font-semibold text-mist-100">{p.name}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-mist-500">
                  {p.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Decorative per-preset header gradients (purely cosmetic).
function presetGradient(id: string): React.CSSProperties {
  const map: Record<string, string> = {
    clean: "linear-gradient(135deg,#2a2f3a,#3a4150)",
    "crisp-portrait": "linear-gradient(135deg,#4a3b36,#6b544a)",
    golden: "linear-gradient(135deg,#7a4e1e,#caa24a)",
    mono: "linear-gradient(135deg,#1a1c20,#4a4f58)",
    cinematic: "linear-gradient(135deg,#1e3a3e,#2b4f55)",
    landscape: "linear-gradient(135deg,#234a2e,#3e7a52)",
  };
  return { backgroundImage: map[id] || map.clean };
}
