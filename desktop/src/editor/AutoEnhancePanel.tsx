import { useEditor } from "../store/editorStore";
import type { AutoMode } from "../types";
import { IconWand, IconCheck, IconClose, IconReset } from "../components/icons";

const MODES: { id: AutoMode; label: string; blurb: string }[] = [
  { id: "natural", label: "Natural", blurb: "Faithful & balanced" },
  { id: "professional", label: "Professional", blurb: "Crisp & refined" },
  { id: "cinematic", label: "Cinematic", blurb: "Moody & graded" },
];

export default function AutoEnhancePanel() {
  const auto = useEditor((s) => s.autoEnhance);
  const setAutoMode = useEditor((s) => s.setAutoMode);
  const setAutoStrength = useEditor((s) => s.setAutoStrength);
  const applyAutoEnhance = useEditor((s) => s.applyAutoEnhance);
  const cancelAutoEnhance = useEditor((s) => s.cancelAutoEnhance);

  if (!auto.open) return null;

  return (
    <div className="lf-fade absolute left-4 top-4 z-30 w-[300px] lf-card p-4 shadow-pop">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
            <IconWand width={16} height={16} />
          </div>
          <span className="text-sm font-semibold text-mist-100">Auto Enhance</span>
          {auto.loading && (
            <span className="lf-spin h-3.5 w-3.5 rounded-full border-2 border-forge-400 border-t-transparent" />
          )}
        </div>
        <button
          onClick={cancelAutoEnhance}
          title="Cancel"
          className="flex h-6 w-6 items-center justify-center rounded text-mist-500 hover:bg-ink-700 hover:text-mist-200"
        >
          <IconClose width={14} height={14} />
        </button>
      </div>

      {/* modes */}
      <div className="grid grid-cols-3 gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setAutoMode(m.id)}
            className={`rounded-lg border px-2 py-2 text-left transition-colors ${
              auto.mode === m.id
                ? "border-forge-500 bg-forge-500/10"
                : "border-ink-600 bg-ink-850 hover:border-ink-500"
            }`}
          >
            <div className={`text-xs font-semibold ${auto.mode === m.id ? "text-forge-300" : "text-mist-200"}`}>
              {m.label}
            </div>
            <div className="mt-0.5 text-[10px] leading-tight text-mist-500">{m.blurb}</div>
          </button>
        ))}
      </div>

      {/* strength */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[12px]">
          <span className="text-mist-300">Strength</span>
          <span className="font-mono text-forge-400">{Math.round(auto.strength)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={auto.strength}
          onChange={(e) => setAutoStrength(parseInt(e.target.value))}
          className="lf-range"
        />
      </div>

      {/* scene + notes */}
      {auto.scene && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip>{auto.scene.cast} light</Chip>
          <Chip>contrast {auto.scene.contrast.toFixed(2)}</Chip>
          {auto.scene.noisy && <Chip>noisy</Chip>}
        </div>
      )}
      {auto.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {auto.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-mist-400">
              <IconCheck width={12} height={12} className="mt-0.5 shrink-0 text-teal" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      {auto.error && <p className="mt-2 text-xs text-ember">{auto.error}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={applyAutoEnhance} className="lf-btn-primary flex-1">
          <IconCheck width={16} height={16} /> Apply
        </button>
        <button onClick={cancelAutoEnhance} className="lf-btn-subtle" title="Discard">
          <IconReset width={16} height={16} />
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-mist-500">
        Applied values land in the sliders on the right — tweak anything afterward.
      </p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] capitalize text-mist-400">
      {children}
    </span>
  );
}
