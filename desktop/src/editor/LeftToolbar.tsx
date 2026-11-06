import { useState } from "react";
import { useEditor } from "../store/editorStore";
import { api } from "../lib/api";
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
  IconExport,
} from "../components/icons";

export default function LeftToolbar() {
  const [maskMessage, setMaskMessage] = useState<string | null>(null);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(2);
  const [upscaleMessage, setUpscaleMessage] = useState<string | null>(null);
  const [upscaleOpen, setUpscaleOpen] = useState(false);
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
  const openDepth = useEditor((s) => s.openDepth);
  const depthOpen = useEditor((s) => s.depthPanel.open);
  const openAssistant = useEditor((s) => s.openAssistant);
  const image = useEditor((s) => s.image);
  const models = useEditor((s) => s.models);
  const setSection = useEditor((s) => s.setSection);
  const addMask = useEditor((s) => s.addMask);
  const openMaskPanel = useEditor((s) => s.openMaskPanel);
  const maskPanelOpen = useEditor((s) => s.maskPanel.open);
  const maskCount = useEditor((s) => s.adjustments.masks.length);

  const addAiMask = async (kind: "subject" | "background" | "sky") => {
    if (!image) return;
    setMaskMessage(null);
    try {
      const result = await api.computeAiMask(image.id, kind);
      if (!result.available) {
        setMaskMessage(result.message ?? "Install BiRefNet in Settings → AI models.");
        setSection("settings");
        return;
      }
      addMask(`ai_${kind}`);
      if (result.message) setMaskMessage(result.message);
    } catch (e) {
      setMaskMessage(e instanceof Error ? e.message : "Could not create AI mask");
    }
  };

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
          <button onClick={() => void openDepth()} disabled={!hasImage} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors disabled:opacity-40 ${depthOpen ? "bg-forge-500/15 text-forge-300" : "text-mist-200 hover:bg-ink-700"}`}>
            <IconLayers width={18} height={18} className="shrink-0"/><span className="flex-1">Depth &amp; Bokeh</span>
          </button>
          <button onClick={openAssistant} disabled={!hasImage} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-200 hover:bg-ink-700 disabled:opacity-40"><IconSparkles width={18} height={18}/><span className="flex-1">Lumetta Assistant</span></button>
          <button onClick={() => setUpscaleOpen((v) => !v)} disabled={!hasImage} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-200 hover:bg-ink-700 disabled:opacity-40"><IconExport width={18} height={18}/><span className="flex-1">Upscale image</span></button>
          {upscaleOpen && <div className="mx-3 mb-2 rounded-lg border border-ink-600 bg-ink-850 p-3">
            <div className="mb-2 text-xs font-medium text-mist-200">Real-ESRGAN enlargement</div>
            <div className="mb-2 flex gap-2">{([2, 4] as const).map((scale) => <button key={scale} onClick={() => setUpscaleScale(scale)} className={`flex-1 rounded px-2 py-1 text-xs ${upscaleScale === scale ? "bg-forge-500/20 text-forge-300" : "bg-ink-700 text-mist-300"}`}>{scale}×</button>)}</div>
            <button onClick={async () => {
              if (!image) return;
              if (!models.some((m) => m.id === "realesrgan_x4plus" && m.installed)) { setSection("settings"); setUpscaleMessage("Install Real-ESRGAN x4plus in Settings → AI models."); return; }
              try { await api.startUpscale(image.id, upscaleScale); setUpscaleMessage("Upscaling queued. Progress is shown in the bottom bar."); }
              catch (e) { setUpscaleMessage(e instanceof Error ? e.message : "Could not start upscaling."); }
            }} className="lf-btn-primary w-full justify-center text-xs">Start {upscaleScale}× upscale</button>
            {upscaleMessage && <p className="mt-2 text-[11px] text-mist-400">{upscaleMessage}</p>}
          </div>}
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
          <button onClick={() => addMask("brush")} disabled={!hasImage} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-200 hover:bg-ink-700 disabled:opacity-40">
            <IconBrush width={18} height={18} /><span className="flex-1">Brush Mask</span>
          </button>
          {(["subject", "background", "sky"] as const).map((kind) => {
            const label = kind[0].toUpperCase() + kind.slice(1);
            const Icon = kind === "subject" ? IconSubject : kind === "sky" ? IconSky : IconLayers;
            const installed = models.some((m) => m.id === "birefnet_lite" && m.installed);
            return <button key={kind} onClick={() => void addAiMask(kind)} disabled={!hasImage} title={installed ? `Create ${label.toLowerCase()} selection` : "Install BiRefNet in Settings → AI models"} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] text-mist-200 hover:bg-ink-700 disabled:opacity-40">
              <Icon width={18} height={18} /><span className="flex-1">{label} Mask</span>
            </button>;
          })}
        </ToolSection>

        <p className="mt-3 px-3 text-[11px] leading-relaxed text-mist-500">
          Masks apply editable local adjustments without changing the source image.
        </p>
        {maskMessage && <p className="px-3 pb-2 text-[11px] text-mist-300">{maskMessage}</p>}
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
