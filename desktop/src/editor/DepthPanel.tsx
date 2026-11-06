import { useEditor } from "../store/editorStore";
import RangeControl from "../components/RangeControl";
import { IconClose, IconCheck, IconFace } from "../components/icons";

export default function DepthPanel() {
  const state = useEditor((s) => s.depthPanel);
  const depth = useEditor((s) => s.adjustments.depth);
  const setField = useEditor((s) => s.setDepthField);
  const close = useEditor((s) => s.closeDepth);
  const begin = useEditor((s) => s.beginGesture);
  const end = useEditor((s) => s.endGesture);
  if (!state.open) return null;
  const control = (field: "focus" | "aperture" | "transition" | "subject_protect" | "highlight_bloom", label: string, min: number, max: number, step = 1) => <RangeControl key={field} label={label} value={depth[field]} min={min} max={max} step={step} onStart={begin} onEnd={end} onChange={(v) => setField(field, v)} />;
  return <div className="lf-fade absolute left-4 top-4 z-30 flex max-h-[88%] w-[320px] flex-col lf-card shadow-pop">
    <div className="flex items-center justify-between border-b border-ink-600 p-3"><div className="flex items-center gap-2"><IconFace width={16} height={16} className="text-forge-400"/><span className="text-sm font-semibold text-mist-100">Depth &amp; Bokeh</span></div><button onClick={close} className="text-mist-400 hover:text-white"><IconClose width={14} height={14}/></button></div>
    <div className="lf-scroll overflow-y-auto p-3">
      {state.loading ? <p className="text-sm text-mist-400">Estimating depth…</p> : null}
      {state.message && <p className="mb-3 rounded-md bg-ink-700 p-2 text-xs text-mist-300">{state.message}</p>}
      <div className="mb-3 flex gap-2">{[1.4, 2, 2.8, 4, 5.6, 8].map((f) => <button key={f} onClick={() => { begin(); setField("aperture", f); end(); }} className={`rounded-md px-2 py-1 text-xs ${depth.aperture === f ? "bg-forge-500/20 text-forge-300" : "bg-ink-700 text-mist-300"}`}>f/{f}</button>)}</div>
      {control("focus", "Focus distance", 0, 1, 0.01)}
      {control("aperture", "Aperture", 1.4, 8, 0.1)}
      {control("transition", "Focus transition", 0, 100)}
      {control("subject_protect", "Subject protection", 0, 100)}
      {control("highlight_bloom", "Highlight bloom", 0, 100)}
      <label className="mt-2 flex items-center justify-between text-xs text-mist-300">Bokeh shape <select value={depth.bokeh_shape} onChange={(e) => setField("bokeh_shape", e.target.value)} className="rounded bg-ink-700 p-1"><option value="round">Round</option><option value="hex">Hexagonal</option></select></label>
    </div>
    <div className="border-t border-ink-600 p-3"><button onClick={close} className="lf-btn-primary w-full"><IconCheck width={16} height={16}/> Done</button></div>
  </div>;
}
