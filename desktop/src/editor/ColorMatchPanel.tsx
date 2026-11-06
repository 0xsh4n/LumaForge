import { useEditor } from "../store/editorStore";
import RangeControl from "../components/RangeControl";
import { IconSparkles, IconClose, IconCheck, IconReset, IconAlert } from "../components/icons";

export default function ColorMatchPanel() {
  const cm = useEditor((s) => s.colorMatch);
  const select = useEditor((s) => s.selectColorMatchCard);
  const setIntensity = useEditor((s) => s.setColorMatchIntensity);
  const apply = useEditor((s) => s.applyColorMatch);
  const cancel = useEditor((s) => s.cancelColorMatch);

  if (!cm.open) return null;

  const tags = cm.scene
    ? [cm.scene.brightness, `${cm.scene.cast} cast`, cm.scene.mood, cm.scene.skin ? "has skin" : null]
        .filter(Boolean) as string[]
    : [];

  return (
    <div className="lf-fade absolute left-4 top-4 z-30 flex max-h-[88%] w-[300px] flex-col lf-card shadow-pop">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
            <IconSparkles width={16} height={16} />
          </div>
          <span className="text-sm font-semibold text-mist-100">AI Color Match</span>
          {cm.loading && (
            <span className="lf-spin h-3.5 w-3.5 rounded-full border-2 border-forge-400 border-t-transparent" />
          )}
        </div>
        <button
          onClick={cancel}
          title="Cancel"
          className="flex h-6 w-6 items-center justify-center rounded text-mist-500 hover:bg-ink-700 hover:text-mist-200"
        >
          <IconClose width={14} height={14} />
        </button>
      </div>

      <div className="lf-scroll flex-1 overflow-y-auto p-3">
        {cm.loading ? (
          <p className="py-4 text-center text-sm text-mist-500">Analyzing colours…</p>
        ) : cm.error ? (
          <p className="flex items-start gap-2 py-2 text-sm text-mist-400">
            <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-ember" />
            <span>{cm.error}</span>
          </p>
        ) : (
          <>
            {tags.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded bg-ink-700 px-2 py-0.5 text-[11px] capitalize text-mist-400">
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {cm.cards.map((card) => {
                const active = cm.activeCardId === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => select(card.id)}
                    className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                      active
                        ? "border-forge-500/60 bg-forge-500/10"
                        : "border-ink-600 bg-ink-850 hover:border-ink-500"
                    }`}
                  >
                    <span
                      className="mt-0.5 h-4 w-4 shrink-0 rounded-full ring-1 ring-black/30"
                      style={{ backgroundColor: card.accent }}
                    />
                    <span className="min-w-0">
                      <span className={`block text-[13px] font-medium ${active ? "text-forge-200" : "text-mist-100"}`}>
                        {card.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-mist-500">
                        {card.description}
                      </span>
                    </span>
                    {active && <IconCheck width={15} height={15} className="ml-auto mt-0.5 shrink-0 text-forge-400" />}
                  </button>
                );
              })}
            </div>

            {cm.activeCardId && (
              <div className="mt-3 border-t border-ink-600 pt-2">
                <RangeControl
                  label="Intensity"
                  value={cm.intensity}
                  min={0}
                  max={100}
                  defaultValue={100}
                  onChange={setIntensity}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-ink-600 p-3">
        <button onClick={apply} disabled={!cm.activeCardId} className="lf-btn-primary flex-1 disabled:opacity-50">
          <IconCheck width={16} height={16} /> Apply
        </button>
        <button onClick={cancel} className="lf-btn-subtle" title="Discard">
          <IconReset width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
