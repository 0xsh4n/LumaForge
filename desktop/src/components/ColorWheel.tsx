import { useRef } from "react";
import type { ColorWheel as Wheel } from "../types";

interface Props {
  label: string;
  value: Wheel;
  onStart: () => void;
  onChange: (w: Wheel) => void;
  onEnd: () => void;
}

// Equiangular unit directions (red up), 120° apart, in screen coords (y down).
const DIRS: [number, number][] = [
  [0, -1], // red (up)
  [0.8660254, 0.5], // green (down-right)
  [-0.8660254, 0.5], // blue (down-left)
];

function rgbToVec(w: Wheel): [number, number] {
  // tight-frame reconstruction: v = (2/3) Σ c_i dir_i
  const c = [w.r / 100, w.g / 100, w.b / 100];
  let vx = 0,
    vy = 0;
  for (let i = 0; i < 3; i++) {
    vx += c[i] * DIRS[i][0];
    vy += c[i] * DIRS[i][1];
  }
  return [(2 / 3) * vx, (2 / 3) * vy];
}

function vecToRgb(vx: number, vy: number): [number, number, number] {
  // c_i = v · dir_i
  return DIRS.map(([dx, dy]) =>
    Math.round(Math.max(-100, Math.min(100, (vx * dx + vy * dy) * 100))),
  ) as [number, number, number];
}

/** Compact 3-way colour-balance wheel + luminance slider. */
export default function ColorWheel({ label, value, onStart, onChange, onEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [vx, vy] = rgbToVec(value);

  const handleMove = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let nx = (clientX - cx) / (rect.width / 2);
    let ny = (clientY - cy) / (rect.height / 2);
    const mag = Math.hypot(nx, ny);
    if (mag > 1) {
      nx /= mag;
      ny /= mag;
    }
    const [r, g, b] = vecToRgb(nx, ny);
    onChange({ ...value, r, g, b });
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = true;
    onStart();
    handleMove(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) handleMove(e.clientX, e.clientY);
  };
  const onUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragging.current = false;
    onEnd();
  };
  const reset = () => {
    onStart();
    onChange({ ...value, r: 0, g: 0, b: 0 });
    onEnd();
  };

  return (
    <div className="flex flex-col items-center">
      <div
        ref={ref}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={reset}
        className="relative aspect-square w-full cursor-crosshair touch-none rounded-full border border-ink-600"
        style={{
          background:
            "radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0) 55%), conic-gradient(from 90deg, #ff4d4d, #ffd24d, #4dff88, #4dd2ff, #4d6bff, #c14dff, #ff4da6, #ff4d4d)",
        }}
      >
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink-900/40 shadow"
          style={{ left: `${50 + vx * 48}%`, top: `${50 + vy * 48}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-mist-400">{label}</div>
    </div>
  );
}
