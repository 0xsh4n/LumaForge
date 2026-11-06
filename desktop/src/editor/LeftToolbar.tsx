import { useEditor } from "../store/editorStore";
import {
  IconImport,
  IconWand,
  IconFace,
  IconSparkles,
  IconSubject,
  IconLayers,
  IconSky,
  IconBrush,
  IconGradientLinear,
  IconGradientRadial,
} from "../components/icons";

interface Tool {
  label: string;
  icon: (p: any) => JSX.Element;
  phase: number;
}

const AI_TOOLS: Tool[] = [];

// AI/model-driven masks (need model inference) — still upcoming.
const MASK_TOOLS: Tool[] = [
  { label: "Subject Mask", icon: IconSubject, phase: 4 },
  { label: "Background Mask", icon: IconLayers, phase: 4 },
  { label: "Sky Mask", icon: IconSky, phase: 4 },
  { label: "Brush Mask", icon: IconBrush, phase: 4 },
];

function UpcomingTool({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <button
      disabled
      title={`${tool.label} — coming soon`}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-500 opacity-70"
    >
      <Icon width={18} height={18} className="shrink-0" />
      <span className="flex-1 truncate">{tool.label}</span>
      <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-mist-500">
        Soon
      </span>
    </button>
  );
}

export default function LeftToolbar() {
  const importImage = useEditor((s) => s.importImage);
  const importing = useEditor((s) => s.importing);
  const importError = useEditor((s) => s.importError);
  const hasImage = useEditor((s) => !!s.image);
  const openAutoEnhance = useEditor((s) => s.openAutoEnhance);
  const autoOpen = useEditor((s) => s.autoEnhance.open);
  const openPortrait = useEditor((s) => s.openPortrait);
  const portraitOpen = useEditor((s) => s.portrait.open);
  const openColorMatch = useEditor((s) => s.openColorMatch);
  const colorMatchOpen = useEditor((s) => s.colorMatch.open);
  const addMask = useEditor((s) => s.addMask);
  const openMaskPanel = useEditor((s) => s.openMaskPanel);
  const maskPanelOpen = useEditor((s) => s.maskPanel.open);
  const maskCount = useEditor((s) => s.adjustments.masks.length);

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-ink-600 bg-ink-800">
      <div className="p-3">
        <button
          onClick={() => void importImage()}
          disabled={importing}
          className="lf-btn-primary w-full"
        >
          <IconImport width={18} height={18} />
          {importing ? "Opening…" : hasImage ? "Import New" : "Import Image"}
        </button>
        {importError && (
          <p className="mt-2 text-xs text-ember">{importError}</p>
        )}
      </div>

      <div className="lf-scroll flex-1 overflow-y-auto px-2 pb-4">
        <ToolSection title="AI Tools">
          <button
            onClick={() => void openAutoEnhance()}
            disabled={!hasImage}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 ${
              autoOpen
                ? "bg-forge-500/15 text-forge-300"
                : "text-mist-200 hover:bg-ink-700"
            }`}
          >
            <IconWand width={18} height={18} className="shrink-0" />
            <span className="flex-1 truncate">AI Auto Enhance</span>
            <span className="rounded bg-forge-500/20 px-1.5 py-0.5 text-[10px] font-medium text-forge-300">
              New
            </span>
          </button>
          <button
            onClick={() => void openPortrait()}
            disabled={!hasImage}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 ${
              portraitOpen ? "bg-forge-500/15 text-forge-300" : "text-mist-200 hover:bg-ink-700"
            }`}
          >
            <IconFace width={18} height={18} className="shrink-0" />
            <span className="flex-1 truncate">AI Portrait Retouch</span>
            <span className="rounded bg-forge-500/20 px-1.5 py-0.5 text-[10px] font-medium text-forge-300">
              New
            </span>
          </button>
          <button
            onClick={() => void openColorMatch()}
            disabled={!hasImage}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 ${
              colorMatchOpen ? "bg-forge-500/15 text-forge-300" : "text-mist-200 hover:bg-ink-700"
            }`}
          >
            <IconSparkles width={18} height={18} className="shrink-0" />
            <span className="flex-1 truncate">AI Color Match</span>
            <span className="rounded bg-forge-500/20 px-1.5 py-0.5 text-[10px] font-medium text-forge-300">
              New
            </span>
          </button>
          {AI_TOOLS.map((t) => (
            <UpcomingTool key={t.label} tool={t} />
          ))}
        </ToolSection>
        <ToolSection title="Masks">
          <button
            onClick={() => addMask("linear")}
            disabled={!hasImage}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-200 transition-colors hover:bg-ink-700 disabled:opacity-40"
          >
            <IconGradientLinear width={18} height={18} className="shrink-0" />
            <span className="flex-1 truncate">Linear Gradient</span>
            <span className="rounded bg-forge-500/20 px-1.5 py-0.5 text-[10px] font-medium text-forge-300">New</span>
          </button>
          <button
            onClick={() => addMask("radial")}
            disabled={!hasImage}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-200 transition-colors hover:bg-ink-700 disabled:opacity-40"
          >
            <IconGradientRadial width={18} height={18} className="shrink-0" />
            <span className="flex-1 truncate">Radial Gradient</span>
            <span className="rounded bg-forge-500/20 px-1.5 py-0.5 text-[10px] font-medium text-forge-300">New</span>
          </button>
          <button
            onClick={openMaskPanel}
            disabled={!hasImage}
            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 ${
              maskPanelOpen ? "bg-forge-500/15 text-forge-300" : "text-mist-200 hover:bg-ink-700"
            }`}
          >
            <IconLayers width={18} height={18} className="shrink-0" />
            <span className="flex-1 truncate">Manage Masks</span>
            {maskCount > 0 && (
              <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-mist-400">
                {maskCount}
              </span>
            )}
          </button>
          {MASK_TOOLS.map((t) => (
            <UpcomingTool key={t.label} tool={t} />
          ))}
        </ToolSection>

        <p className="mt-3 px-3 text-[11px] leading-relaxed text-mist-500">
          Linear & radial masks apply local edits non-destructively. AI subject/sky
          masks and brush painting unlock once their models are installed.
        </p>
      </div>
    </aside>
  );
}

function ToolSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-mist-500">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
