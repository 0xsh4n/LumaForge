import { useEffect, useRef } from "react";
import type { Histogram as HistogramData } from "../types";

interface Props {
  data: HistogramData | null;
  height?: number;
}

/** Lightweight RGB + luma histogram drawn to a canvas. */
export default function Histogram({ data, height = 72 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!data) return;

    const bins = data.bins;
    const all = [...data.red, ...data.green, ...data.blue];
    const max = Math.max(1, ...all);

    const drawChannel = (vals: number[], color: string) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < bins; i++) {
        const x = (i / (bins - 1)) * w;
        const y = h - (vals[i] / max) * h;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    ctx.globalCompositeOperation = "lighter";
    drawChannel(data.red, "rgba(239,68,68,0.55)");
    drawChannel(data.green, "rgba(34,197,94,0.55)");
    drawChannel(data.blue, "rgba(59,130,246,0.6)");
    ctx.globalCompositeOperation = "source-over";
  }, [data, height]);

  return (
    <div
      className="w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-850"
      style={{ height }}
    >
      <canvas ref={ref} className="h-full w-full" />
    </div>
  );
}
