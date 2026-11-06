import { useEditor } from "../store/editorStore";
import type { LocalAdjust, Mask } from "../types";
import RangeControl from "../components/RangeControl";
import {
  IconLayers,
  IconClose,
  IconCheck,
  IconGradientLinear,
  IconGradientRadial,
} from "../components/icons";

interface LocalCtl {
  field: keyof LocalAdjust;
  label: string;
  min: number;
  max: number;
  step?: number;
  bipolar?: boolean;
}
const LOCAL_GROUPS: { title: string; controls: LocalCtl[] }[] = [
  {
    title: "Light",
    controls: [
      { field: "exposure", label: "Exposure", min: -5, max: 5, step: 0.01, bipolar: true },
      { field: "contrast", label: "Contrast", min: -100, max: 100, bipolar: true },
      { field: "highlights", label: "Highlights", min: -100, max: 100, bipolar: true },
      { field: "shadows", label: "Shadows", min: -100, max: 100, bipolar: true },
      { field: "whites", label: "Whites", min: -100, max: 100, bipolar: true },
      { field: "blacks", label: "Blacks", min: -100, max: 100, bipolar: true },
    ],
  },
  {
    title: "Color",
    controls: [
      { field: "temperature", label: "Temperature", min: -100, max: 100, bipolar: true },
      { field: "tint", label: "Tint", min: -100, max: 100, bipolar: true },
      { field: "saturation", label: "Saturation", min: -100, max: 100, bipolar: true },
      { field: "vibrance", label: "Vibrance", min: -100, max: 100, bipolar: true },
    ],
  },
  {
    title: "Detail",
    controls: [
      { field: "clarity", label: "Clarity", min: -100, max: 100, bipolar: true },
      { field: "sharpness", label: "Sharpness", min: 0, max: 100 },
      { field: "blur", label: "Blur (defocus)", min: 0, max: 100 },
    ],
  },
];

export default function MasksPanel() {
  const open = useEditor((s) => s.maskPanel.open);
  const activeId = useEditor((s) => s.maskPanel.activeId);
  const masks = useEditor((s) => s.adjustments.masks);
  const addMask = useEditor((s) => s.addMask);
  const removeMask = useEditor((s) => s.removeMask);
  const selectMask = useEditor((s) => s.selectMask);
  const setMaskField = useEditor((s) => s.setMaskField);
  const setMaskLocal = useEditor((s) => s.setMaskLocal);
  const closeMaskPanel = useEditor((s) => s.closeMaskPanel);
  const beginGesture = useEditor((s) => s.beginGesture);
  const endGesture = useEditor((s) => s.endGesture);
  const brush = useEditor((s) => s.maskPanel.brush);
  const setBrushSetting = useEditor((s) => s.setBrushSetting);
  const clearBrush = useEditor((s) => s.clearBrush);

  if (!open) return null;

  const active: Mask | undefined =
    masks.find((m) => m.id === activeId) ?? masks[masks.length - 1];

  // Toggle an immediate boolean field as one undo step.
  const toggle = (id: string, field: "enabled" | "invert", value: boolean) => {
    beginGesture();
    setMaskField(id, field, value);
    endGesture();
  };

  const geo = (field: keyof Mask, label: string, min: number, max: number,
               step = 1, bipolar = false) =>
    active && (
      <RangeControl
        label={label}
        value={active[field] as number}
        min={min}
        max={max}
        step={step}
        bipolar={bipolar}
        onStart={beginGesture}
        onEnd={endGesture}
        onChange={(v) => setMaskField(active.id, field, v)}
      />
    );

  return (
    <div className="lf-fade absolute left-4 top-4 z-30 flex max-h-[88%] w-[320px] flex-col lf-card shadow-pop">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
            <IconLayers width={16} height={16} />
          </div>
          <span className="text-sm font-semibold text-mist-100">Masks</span>
        </div>
        <button
          onClick={closeMaskPanel}
          title="Close"
          className="flex h-6 w-6 items-center justify-center rounded text-mist-500 hover:bg-ink-700 hover:text-mist-200"
        >
          <IconClose width={14} height={14} />
        </button>
      </div>

      <div className="lf-scroll flex-1 overflow-y-auto p-3">
        {/* add mask */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button onClick={() => addMask("linear")} className="lf-btn-subtle justify-center text-xs">
            <IconGradientLinear width={15} height={15} /> Linear
          </button>
          <button onClick={() => addMask("radial")} className="lf-btn-subtle justify-center text-xs">
            <IconGradientRadial width={15} height={15} /> Radial
          </button>
          <button onClick={() => addMask("brush")} className="lf-btn-subtle col-span-2 justify-center text-xs">
            <IconLayers width={15} height={15} /> Brush
          </button>
        </div>

        {masks.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-mist-500">
            Add a linear or radial mask, then adjust only the selected area —
            non-destructively, like every other edit.
          </p>
        ) : (
          <>
            {/* layer list */}
            <div className="mb-3 space-y-1">
              {masks.map((m) => {
                const isActive = active?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[13px] ${
                      isActive
                        ? "border-forge-500/60 bg-forge-500/10"
                        : "border-ink-600 bg-ink-850 hover:border-ink-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={(e) => toggle(m.id, "enabled", e.target.checked)}
                      title="Toggle mask"
                      className="accent-forge-500"
                    />
                    <button
                      onClick={() => selectMask(m.id)}
                      className={`flex-1 truncate text-left ${isActive ? "text-forge-200" : "text-mist-200"}`}
                    >
                      {m.name}
                    </button>
                    <button
                      onClick={() => removeMask(m.id)}
                      title="Remove mask"
                      className="flex h-5 w-5 items-center justify-center rounded text-mist-500 hover:bg-ink-700 hover:text-ember"
                    >
                      <IconClose width={12} height={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {active && (
              <>
                {/* geometry */}
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-mist-500">
                  {active.type === "linear" ? "Gradient" : "Shape"}
                </div>
                {active.type === "brush" ? (
                  <div className="space-y-2 py-2">
                    <label className="block text-xs text-mist-300">Brush size <input className="w-full accent-forge-500" type="range" min="0.003" max="0.15" step="0.001" value={brush.radius} onChange={(e) => setBrushSetting("radius", Number(e.target.value))} /></label>
                    <label className="block text-xs text-mist-300">Hardness <input className="w-full accent-forge-500" type="range" min="0" max="1" step="0.01" value={brush.hardness} onChange={(e) => setBrushSetting("hardness", Number(e.target.value))} /></label>
                    <label className="flex items-center gap-2 text-xs text-mist-300"><input type="checkbox" checked={brush.erase} onChange={(e) => setBrushSetting("erase", e.target.checked)} />Erase</label>
                    <button className="lf-btn-subtle w-full justify-center text-xs" onClick={() => clearBrush(active.id)}>Clear stroke</button>
                  </div>
                ) : active.type === "linear" ? (
                  <>
                    {geo("angle", "Angle", -180, 180, 1, true)}
                    {geo("start", "Start", 0, 1, 0.01)}
                    {geo("end", "End", 0, 1, 0.01)}
                  </>
                ) : (
                  <>
                    {geo("cx", "Center X", 0, 1, 0.01)}
                    {geo("cy", "Center Y", 0, 1, 0.01)}
                    {geo("rx", "Width", 0.05, 1, 0.01)}
                    {geo("ry", "Height", 0.05, 1, 0.01)}
                  </>
                )}
                {geo("feather", "Feather", 0, 100)}
                {geo("opacity", "Opacity", 0, 100)}

                <label className="mt-1 flex cursor-pointer items-center gap-2 py-1 text-[13px] text-mist-300">
                  <input
                    type="checkbox"
                    checked={active.invert}
                    onChange={(e) => toggle(active.id, "invert", e.target.checked)}
                    className="accent-forge-500"
                  />
                  Invert mask
                </label>

                {/* local adjustments */}
                <div className="mt-3 border-t border-ink-600 pt-2">
                  {LOCAL_GROUPS.map((g) => (
                    <div key={g.title} className="mb-1">
                      <div className="mb-0.5 mt-1 text-[11px] font-medium uppercase tracking-wide text-mist-500">
                        {g.title}
                      </div>
                      {g.controls.map((c) => (
                        <RangeControl
                          key={c.field}
                          label={c.label}
                          value={active.local[c.field]}
                          min={c.min}
                          max={c.max}
                          step={c.step ?? 1}
                          bipolar={c.bipolar}
                          onStart={beginGesture}
                          onEnd={endGesture}
                          onChange={(v) => setMaskLocal(active.id, c.field, v)}
                          onReset={() => {
                            beginGesture();
                            setMaskLocal(active.id, c.field, 0);
                            endGesture();
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-ink-600 p-3">
        <button onClick={closeMaskPanel} className="lf-btn-primary flex-1">
          <IconCheck width={16} height={16} /> Done
        </button>
      </div>
    </div>
  );
}
