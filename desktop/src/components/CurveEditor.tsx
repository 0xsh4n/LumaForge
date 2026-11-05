import { useRef } from "react";
import type { CurvePoint } from "../types";

interface Props {
  points: CurvePoint[];
  color?: string;
  onStart: () => void;
  onChange: (points: CurvePoint[]) => void;
  onEnd: () => void;
}

const N = 100; // svg viewBox units

function interp(points: CurvePoint[], x: number): number {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return x;
}

/** Interactive tone-curve editor: drag points, click to add, double-click to remove. */
export default function CurveEditor({ points, color = "#e7eaf1", onStart, onChange, onEnd }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragIdx = useRef<number | null>(null);

  const sorted = [...points].sort((a, b) => a[0] - b[0]);

  const toData = (clientX: number, clientY: number): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height));
    return [x, y];
  };

  const sx = (x: number) => x * N;
  const sy = (y: number) => (1 - y) * N;

  // curve polyline
  const steps = 48;
  const path = Array.from({ length: steps + 1 }, (_, i) => {
    const x = i / steps;
    return `${sx(x).toFixed(2)},${sy(interp(sorted, x)).toFixed(2)}`;
  }).join(" ");

  const startDrag = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragIdx.current = idx;
    onStart();
  };

  const onMove = (e: React.PointerEvent) => {
    if (dragIdx.current === null) return;
    const idx = dragIdx.current;
    const [nx, ny] = toData(e.clientX, e.clientY);
    const next = sorted.map((p) => [...p] as CurvePoint);
    if (idx === 0) {
      next[0] = [0, ny];
    } else if (idx === next.length - 1) {
      next[next.length - 1] = [1, ny];
    } else {
      const lo = next[idx - 1][0] + 0.01;
      const hi = next[idx + 1][0] - 0.01;
      next[idx] = [Math.min(hi, Math.max(lo, nx)), ny];
    }
    onChange(next);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (dragIdx.current === null) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragIdx.current = null;
    onEnd();
  };

  const addPoint = (e: React.PointerEvent) => {
    const [x, y] = toData(e.clientX, e.clientY);
    if (x <= 0.02 || x >= 0.98) return; // don't collide with endpoints
    onStart();
    const next = [...sorted, [x, y] as CurvePoint].sort((a, b) => a[0] - b[0]);
    onChange(next);
    onEnd();
  };

  const removePoint = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0 || idx === sorted.length - 1) return;
    onStart();
    onChange(sorted.filter((_, i) => i !== idx));
    onEnd();
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${N} ${N}`}
      className="aspect-square w-full touch-none rounded-lg border border-ink-600 bg-ink-850"
      onPointerDown={addPoint}
      onPointerMove={onMove}
      onPointerUp={endDrag}
    >
      {/* grid */}
      {[0.25, 0.5, 0.75].map((g) => (
        <g key={g} stroke="#242933" strokeWidth={0.4}>
          <line x1={g * N} y1={0} x2={g * N} y2={N} />
          <line x1={0} y1={g * N} x2={N} y2={g * N} />
        </g>
      ))}
      {/* identity reference */}
      <line x1={0} y1={N} x2={N} y2={0} stroke="#2e3442" strokeWidth={0.5} strokeDasharray="2 2" />
      {/* curve */}
      <polyline points={path} fill="none" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      {/* points */}
      {sorted.map((p, i) => (
        <circle
          key={i}
          cx={sx(p[0])}
          cy={sy(p[1])}
          r={2.6}
          fill={color}
          stroke="#07080a"
          strokeWidth={0.8}
          className="cursor-grab"
          onPointerDown={startDrag(i)}
          onDoubleClick={removePoint(i)}
        />
      ))}
    </svg>
  );
}
