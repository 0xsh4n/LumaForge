import { useCallback } from "react";
import type { AdjustGroup } from "../types";
import type { SliderSpec } from "../lib/adjustments";
import { useEditor } from "../store/editorStore";

interface Props {
  group: AdjustGroup;
  spec: SliderSpec;
}

/** One labelled, themed slider wired to the store with undo-friendly gestures. */
export default function Slider({ group, spec }: Props) {
  const value = useEditor(
    (s) => (s.adjustments[group] as unknown as Record<string, number>)[spec.key],
  );
  const beginGesture = useEditor((s) => s.beginGesture);
  const setAdjustment = useEditor((s) => s.setAdjustment);
  const endGesture = useEditor((s) => s.endGesture);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAdjustment(group, spec.key, parseFloat(e.target.value));
    },
    [group, spec.key, setAdjustment],
  );

  // double-click label/value resets this one slider to its default
  const resetOne = useCallback(() => {
    beginGesture();
    setAdjustment(group, spec.key, spec.default);
    endGesture();
  }, [beginGesture, setAdjustment, endGesture, group, spec.key, spec.default]);

  const changed = Math.abs(value - spec.default) > 1e-6;
  const pct = ((value - spec.min) / (spec.max - spec.min)) * 100;
  // For bipolar sliders, draw the filled portion from the center out.
  const fill = spec.bipolar
    ? (() => {
        const center = ((0 - spec.min) / (spec.max - spec.min)) * 100;
        const lo = Math.min(center, pct);
        const hi = Math.max(center, pct);
        return { left: `${lo}%`, width: `${hi - lo}%` };
      })()
    : { left: "0%", width: `${pct}%` };

  const display =
    spec.step < 1 ? value.toFixed(2) : Math.round(value).toString();

  return (
    <div className="group py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <button
          onDoubleClick={resetOne}
          className="text-[13px] text-mist-300 transition-colors hover:text-mist-100"
          title="Double-click to reset"
        >
          {spec.label}
        </button>
        <button
          onDoubleClick={resetOne}
          className={`font-mono text-xs tabular-nums ${
            changed ? "text-forge-400" : "text-mist-500"
          }`}
          title="Double-click to reset"
        >
          {spec.bipolar && value > 0 ? `+${display}` : display}
        </button>
      </div>
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-0 right-0 h-1 rounded-full bg-ink-600" />
        <div
          className="pointer-events-none absolute h-1 rounded-full bg-forge-500/80"
          style={fill}
        />
        <input
          type="range"
          className="lf-range relative z-10 bg-transparent"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onPointerDown={beginGesture}
          onPointerUp={endGesture}
          onKeyDown={beginGesture}
          onKeyUp={endGesture}
          onBlur={endGesture}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
