import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "../store/editorStore";
import { IconImport } from "../components/icons";

export default function PreviewCanvas() {
  const image = useEditor((s) => s.image);
  const previewUrl = useEditor((s) => s.previewUrl);
  const originalUrl = useEditor((s) => s.originalUrl);
  const rendering = useEditor((s) => s.rendering);
  const renderError = useEditor((s) => s.renderError);
  const compare = useEditor((s) => s.compare);
  const splitPos = useEditor((s) => s.splitPos);
  const setSplitPos = useEditor((s) => s.setSplitPos);
  const showOriginal = useEditor((s) => s.showOriginal);
  const zoom = useEditor((s) => s.zoom);
  const fitToScreen = useEditor((s) => s.fitToScreen);
  const setZoom = useEditor((s) => s.setZoom);
  const importImage = useEditor((s) => s.importImage);
  const maskPanel = useEditor((s) => s.maskPanel);
  const masks = useEditor((s) => s.adjustments.masks);
  const beginGesture = useEditor((s) => s.beginGesture);
  const endGesture = useEditor((s) => s.endGesture);
  const addBrushDab = useEditor((s) => s.addBrushDab);
  const brush = maskPanel.brush;

  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<null | { kind: "pan" | "split"; sx: number; sy: number; ox: number; oy: number }>(null);
  const brushStroke = useRef<null | { id: string; lastX: number; lastY: number }>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // reset pan whenever we snap back to fit
  useEffect(() => {
    if (fitToScreen) setPan({ x: 0, y: 0 });
  }, [fitToScreen, image?.id]);

  if (!image) {
    return (
      <div className="flex h-full w-full items-center justify-center lf-checker">
        <button
          onClick={() => void importImage()}
          className="lf-fade flex flex-col items-center gap-4 rounded-2xl border border-dashed border-ink-500 px-16 py-14 text-mist-400 transition-colors hover:border-forge-500/60 hover:text-mist-200"
        >
          <IconImport width={40} height={40} />
          <div className="text-center">
            <div className="text-base font-medium text-mist-200">Import a photograph</div>
            <div className="mt-1 text-sm text-mist-500">
              JPEG · PNG · WebP · TIFF · HEIC · RAW
            </div>
          </div>
        </button>
      </div>
    );
  }

  const aspect = image.width / image.height;
  const fitScale = box.w && box.h ? Math.min(box.w / image.width, box.h / image.height) : 0;
  const scale = fitToScreen ? fitScale : fitScale * zoom;
  const dispW = image.width * scale;
  const dispH = image.height * scale;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const next = Math.min(8, Math.max(0.1, (fitToScreen ? 1 : zoom) * factor));
    setZoom(next, false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (compare === "split") return;
    const activeMask = masks.find((m) => m.id === maskPanel.activeId);
    if (maskPanel.open && activeMask?.type === "brush") {
      const imageBox = (e.currentTarget as HTMLElement).querySelector("[data-canvas-image]")?.getBoundingClientRect();
      if (!imageBox || e.clientX < imageBox.left || e.clientX > imageBox.right || e.clientY < imageBox.top || e.clientY > imageBox.bottom) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      beginGesture();
      brushStroke.current = { id: activeMask.id, lastX: e.clientX, lastY: e.clientY };
      addBrushDab(activeMask.id, { x: (e.clientX - imageBox.left) / imageBox.width, y: (e.clientY - imageBox.top) / imageBox.height, radius: brush.radius, hardness: brush.hardness, erase: brush.erase });
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (brushStroke.current) {
      const imageBox = (e.currentTarget as HTMLElement).querySelector("[data-canvas-image]")?.getBoundingClientRect();
      const stroke = brushStroke.current;
      if (!imageBox) return;
      if (Math.hypot(e.clientX - stroke.lastX, e.clientY - stroke.lastY) < 4) return;
      stroke.lastX = e.clientX; stroke.lastY = e.clientY;
      addBrushDab(stroke.id, { x: Math.min(1, Math.max(0, (e.clientX - imageBox.left) / imageBox.width)), y: Math.min(1, Math.max(0, (e.clientY - imageBox.top) / imageBox.height)), radius: brush.radius, hardness: brush.hardness, erase: brush.erase });
      return;
    }
    const d = dragging.current;
    if (!d) return;
    if (d.kind === "pan") {
      setPan({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (brushStroke.current) { brushStroke.current = null; endGesture(); return; }
    dragging.current = null;
  };

  const base = previewUrl || originalUrl || undefined;
  const topLayer = showOriginal ? originalUrl : previewUrl;

  // Common style for an image layer filling the display box.
  const layerStyle: React.CSSProperties = {
    width: dispW,
    height: dispH,
    maxWidth: "none",
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden lf-checker"
      onWheel={onWheel}
    >
      {/* processing bar */}
      {rendering && (
        <div className="absolute left-0 right-0 top-0 z-30 h-0.5 overflow-hidden bg-transparent">
          <div className="h-full w-1/3 animate-[lf-slide_1s_ease-in-out_infinite] bg-forge-500" />
        </div>
      )}
      {renderError && (
        <div className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-md bg-ember/90 px-3 py-1.5 text-xs text-white shadow-pop">
          {renderError}
        </div>
      )}

      {compare === "side" ? (
        <div className="flex h-full w-full">
          <Half label="Original" src={originalUrl} aspect={aspect} />
          <div className="w-px bg-ink-600" />
          <Half label="Edited" src={previewUrl || originalUrl} aspect={aspect} />
        </div>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ cursor: compare === "split" ? "default" : "grab" }}
        >
          <div
            data-canvas-image
            className="relative"
            style={{ width: dispW, height: dispH, transform: `translate(${pan.x}px, ${pan.y}px)` }}
          >
            {/* original underneath */}
            {originalUrl && (
              <img src={originalUrl} alt="original" draggable={false} className="absolute inset-0 select-none" style={layerStyle} />
            )}
            {/* edited on top, clipped for split */}
            {base && (
              <img
                src={topLayer || base}
                alt="edited"
                draggable={false}
                className="absolute inset-0 select-none"
                style={{
                  ...layerStyle,
                  clipPath: compare === "split" ? `inset(0 ${(1 - splitPos) * 100}% 0 0)` : undefined,
                }}
              />
            )}

            {maskPanel.open && (() => {
              const selected = masks.find((m) => m.id === maskPanel.activeId);
              if (!selected || selected.type !== "brush") return null;
              return <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none">{selected.dabs.map((dab, i) => <circle key={i} cx={dab.x} cy={dab.y} r={dab.radius * Math.max(image.width, image.height) / image.width} fill={dab.erase ? "transparent" : "rgba(255,55,70,.18)"} stroke="rgba(255,55,70,.35)" strokeWidth=".002" />)}</svg>;
            })()}

            {compare === "split" && (
              <SplitHandle
                pos={splitPos}
                onDrag={(p) => setSplitPos(p)}
                width={dispW}
              />
            )}
          </div>
        </div>
      )}

      {/* corner labels */}
      {compare === "off" && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md bg-ink-900/70 px-2 py-1 text-[11px] font-medium text-mist-300 backdrop-blur">
          {showOriginal ? "Original" : "Edited"}
        </div>
      )}
    </div>
  );
}

function Half({ label, src, aspect }: { label: string; src: string | null; aspect: number }) {
  return (
    <div className="relative flex min-w-0 flex-1 items-center justify-center p-2">
      {src && (
        <img
          src={src}
          alt={label}
          draggable={false}
          className="max-h-full max-w-full select-none object-contain"
          style={{ aspectRatio: aspect }}
        />
      )}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-ink-900/70 px-2 py-1 text-[11px] font-medium text-mist-300 backdrop-blur">
        {label}
      </div>
    </div>
  );
}

function SplitHandle({
  pos,
  onDrag,
  width,
}: {
  pos: number;
  onDrag: (p: number) => void;
  width: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const down = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const move = (clientX: number) => onDrag((clientX - rect.left) / Math.max(1, width));
    move(e.clientX);
    const onMove = (ev: PointerEvent) => move(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  return (
    <div
      ref={ref}
      onPointerDown={down}
      className="absolute top-0 z-20 flex h-full w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center"
      style={{ left: `${pos * 100}%` }}
    >
      <div className="h-full w-px bg-white/80 shadow-[0_0_6px_rgba(0,0,0,0.6)]" />
      <div className="absolute flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-ink-900/80 text-white backdrop-blur">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m9 7-4 5 4 5M15 7l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
