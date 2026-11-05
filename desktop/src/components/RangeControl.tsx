interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  bipolar?: boolean;
  defaultValue?: number;
  format?: (v: number) => string;
  onStart?: () => void;
  onChange: (v: number) => void;
  onEnd?: () => void;
  onReset?: () => void;
}

/** Presentational themed slider (decoupled from the store) for grade controls. */
export default function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  bipolar,
  defaultValue = 0,
  format,
  onStart,
  onChange,
  onEnd,
  onReset,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;
  const fill = bipolar
    ? (() => {
        const center = ((0 - min) / (max - min)) * 100;
        const lo = Math.min(center, pct);
        const hi = Math.max(center, pct);
        return { left: `${lo}%`, width: `${hi - lo}%` };
      })()
    : { left: "0%", width: `${pct}%` };
  const changed = Math.abs(value - defaultValue) > 1e-6;
  const display = format ? format(value) : step < 1 ? value.toFixed(2) : Math.round(value).toString();

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-center justify-between">
        <button
          onDoubleClick={onReset}
          className="text-[12px] text-mist-300 hover:text-mist-100"
          title={onReset ? "Double-click to reset" : undefined}
        >
          {label}
        </button>
        <span className={`font-mono text-[11px] ${changed ? "text-forge-400" : "text-mist-500"}`}>
          {bipolar && value > 0 ? `+${display}` : display}
        </span>
      </div>
      <div className="relative flex items-center">
        <div className="pointer-events-none absolute left-0 right-0 h-1 rounded-full bg-ink-600" />
        <div className="pointer-events-none absolute h-1 rounded-full bg-forge-500/80" style={fill} />
        <input
          type="range"
          className="lf-range relative z-10 bg-transparent"
          min={min}
          max={max}
          step={step}
          value={value}
          onPointerDown={onStart}
          onPointerUp={onEnd}
          onBlur={onEnd}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
