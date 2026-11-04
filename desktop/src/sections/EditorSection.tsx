import { useEditor } from "../store/editorStore";
import LeftToolbar from "../editor/LeftToolbar";
import PreviewCanvas from "../editor/PreviewCanvas";
import AdjustPanel from "../editor/AdjustPanel";
import BottomBar from "../editor/BottomBar";
import { IconClose } from "../components/icons";

export default function EditorSection() {
  const image = useEditor((s) => s.image);
  const closeImage = useEditor((s) => s.closeImage);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <LeftToolbar />
        <div className="flex min-w-0 flex-1 flex-col">
          {image && (
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-ink-600 bg-ink-800 px-4">
              <div className="flex min-w-0 items-center gap-3 text-sm">
                <span className="truncate font-medium text-mist-200">{image.filename}</span>
                <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium uppercase text-mist-400">
                  {image.format}
                </span>
                <span className="shrink-0 text-xs text-mist-500">
                  {image.width}×{image.height} · {image.bit_depth}-bit
                </span>
              </div>
              <button
                onClick={closeImage}
                title="Close image"
                className="flex h-7 w-7 items-center justify-center rounded-md text-mist-400 hover:bg-ink-700 hover:text-mist-100"
              >
                <IconClose width={16} height={16} />
              </button>
            </div>
          )}
          <div className="relative min-h-0 flex-1">
            <PreviewCanvas />
          </div>
        </div>
        <AdjustPanel />
      </div>
      <BottomBar />
    </div>
  );
}
