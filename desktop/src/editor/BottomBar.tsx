import { useState } from "react";
import { useEditor } from "../store/editorStore";
import { isNeutral } from "../lib/adjustments";
import type { ExportFormat } from "../types";
import {
  IconUndo,
  IconRedo,
  IconReset,
  IconEye,
  IconSplit,
  IconSideBySide,
  IconZoomIn,
  IconZoomOut,
  IconFit,
  IconExport,
  IconCheck,
  IconAlert,
} from "../components/icons";

function IconBtn({
  title,
  onClick,
  disabled,
  active,
  children,
}: {
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active ? "bg-forge-500/20 text-forge-400" : "text-mist-300 hover:bg-ink-700 hover:text-mist-100"
      }`}
    >
      {children}
    </button>
  );
}

export default function BottomBar() {
  const past = useEditor((s) => s.past);
  const future = useEditor((s) => s.future);
  const adjustments = useEditor((s) => s.adjustments);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const reset = useEditor((s) => s.reset);
  const compare = useEditor((s) => s.compare);
  const setCompare = useEditor((s) => s.setCompare);
  const setShowOriginal = useEditor((s) => s.setShowOriginal);
  const zoom = useEditor((s) => s.zoom);
  const fitToScreen = useEditor((s) => s.fitToScreen);
  const setZoom = useEditor((s) => s.setZoom);

  const [exportOpen, setExportOpen] = useState(false);

  const z = fitToScreen ? 1 : zoom;

  return (
    <div className="relative flex h-12 shrink-0 items-center justify-between border-t border-ink-600 bg-ink-800 px-3">
      {/* left: history */}
      <div className="flex items-center gap-1">
        <IconBtn title="Undo (Ctrl+Z)" onClick={undo} disabled={past.length === 0}>
          <IconUndo />
        </IconBtn>
        <IconBtn title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={future.length === 0}>
          <IconRedo />
        </IconBtn>
        <IconBtn title="Reset all" onClick={reset} disabled={isNeutral(adjustments)}>
          <IconReset />
        </IconBtn>
        <span className="ml-2 text-[11px] text-mist-500">
          {past.length} edit{past.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* center: compare */}
      <div className="flex items-center gap-1">
        <button
          title="Hold to view original"
          onPointerDown={() => setShowOriginal(true)}
          onPointerUp={() => setShowOriginal(false)}
          onPointerLeave={() => setShowOriginal(false)}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-mist-300 transition-colors hover:bg-ink-700 hover:text-mist-100"
        >
          <IconEye width={16} height={16} />
          Before
        </button>
        <div className="mx-1 h-5 w-px bg-ink-600" />
        <IconBtn
          title="No comparison"
          active={compare === "off"}
          onClick={() => setCompare("off")}
        >
          <span className="text-xs font-semibold">1:1</span>
        </IconBtn>
        <IconBtn
          title="Split comparison"
          active={compare === "split"}
          onClick={() => setCompare("split")}
        >
          <IconSplit />
        </IconBtn>
        <IconBtn
          title="Side-by-side comparison"
          active={compare === "side"}
          onClick={() => setCompare("side")}
        >
          <IconSideBySide />
        </IconBtn>
      </div>

      {/* right: zoom + export */}
      <div className="flex items-center gap-1">
        <IconBtn title="Zoom out" onClick={() => setZoom(z / 1.25, false)}>
          <IconZoomOut />
        </IconBtn>
        <button
          onClick={() => setZoom(1, true)}
          title="Fit to screen"
          className="min-w-[48px] rounded-md px-1 py-1 text-center font-mono text-xs text-mist-300 hover:bg-ink-700"
        >
          {fitToScreen ? "Fit" : `${Math.round(zoom * 100)}%`}
        </button>
        <IconBtn title="Zoom in" onClick={() => setZoom(z * 1.25, false)}>
          <IconZoomIn />
        </IconBtn>
        <IconBtn title="Fit to screen" onClick={() => setZoom(1, true)} active={fitToScreen}>
          <IconFit />
        </IconBtn>
        <div className="mx-1 h-5 w-px bg-ink-600" />
        <button onClick={() => setExportOpen((o) => !o)} className="lf-btn-primary h-8 px-3">
          <IconExport width={16} height={16} />
          Export
        </button>
      </div>

      {exportOpen && <ExportPopover onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function ExportPopover({ onClose }: { onClose: () => void }) {
  const exportImage = useEditor((s) => s.exportImage);
  const exportState = useEditor((s) => s.exportState);
  const image = useEditor((s) => s.image);

  const [format, setFormat] = useState<ExportFormat>("jpeg");
  const [quality, setQuality] = useState(92);
  const [resizeOn, setResizeOn] = useState(false);
  const [longEdge, setLongEdge] = useState(
    image ? Math.max(image.width, image.height) : 4000,
  );

  const lossy = format === "jpeg" || format === "webp";
  const busy = exportState.state === "exporting";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="lf-fade absolute bottom-14 right-3 z-50 w-72 lf-card p-4 shadow-pop">
        <div className="mb-3 text-sm font-semibold text-mist-100">Export</div>

        <label className="mb-1 block text-[11px] uppercase tracking-wide text-mist-500">
          Format
        </label>
        <div className="mb-3 grid grid-cols-4 gap-1">
          {(["jpeg", "png", "webp", "tiff"] as ExportFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`rounded-md py-1.5 text-xs font-medium uppercase transition-colors ${
                format === f ? "bg-forge-500 text-ink-900" : "bg-ink-700 text-mist-300 hover:bg-ink-600"
              }`}
            >
              {f === "jpeg" ? "JPG" : f}
            </button>
          ))}
        </div>

        {lossy && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-[11px] text-mist-400">
              <span>Quality</span>
              <span className="font-mono">{quality}</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value))}
              className="lf-range"
            />
          </div>
        )}

        <label className="mb-3 flex items-center gap-2 text-[13px] text-mist-300">
          <input
            type="checkbox"
            checked={resizeOn}
            onChange={(e) => setResizeOn(e.target.checked)}
            className="accent-forge-500"
          />
          Resize longest edge
          {resizeOn && (
            <input
              type="number"
              value={longEdge}
              min={16}
              onChange={(e) => setLongEdge(parseInt(e.target.value) || 16)}
              className="ml-auto w-20 rounded border border-ink-600 bg-ink-850 px-2 py-1 text-right font-mono text-xs"
            />
          )}
        </label>

        <button
          onClick={() =>
            void exportImage({
              format,
              quality,
              resizeLongEdge: resizeOn ? longEdge : null,
            })
          }
          disabled={busy}
          className="lf-btn-primary w-full"
        >
          {busy ? (
            <>
              <span className="lf-spin h-4 w-4 rounded-full border-2 border-ink-900 border-t-transparent" />
              Exporting…
            </>
          ) : (
            <>
              <IconExport width={16} height={16} />
              Export image
            </>
          )}
        </button>

        {exportState.state === "done" && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-teal">
            <IconCheck width={14} height={14} className="mt-0.5 shrink-0" />
            <span className="break-all">{exportState.message}</span>
          </p>
        )}
        {exportState.state === "error" && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ember">
            <IconAlert width={14} height={14} className="mt-0.5 shrink-0" />
            <span>{exportState.message}</span>
          </p>
        )}
      </div>
    </>
  );
}
