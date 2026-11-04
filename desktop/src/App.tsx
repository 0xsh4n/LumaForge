import { useEffect } from "react";
import { useEditor } from "./store/editorStore";
import NavRail from "./components/NavRail";
import HomeSection from "./sections/HomeSection";
import EditorSection from "./sections/EditorSection";
import AIEnhanceSection from "./sections/AIEnhanceSection";
import PresetsSection from "./sections/PresetsSection";
import SettingsSection from "./sections/SettingsSection";
import { IconAlert } from "./components/icons";

export default function App() {
  const section = useEditor((s) => s.section);
  const initBackend = useEditor((s) => s.initBackend);
  const backend = useEditor((s) => s.backend);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setShowOriginal = useEditor((s) => s.setShowOriginal);

  useEffect(() => {
    void initBackend();
  }, [initBackend]);

  // global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "\\") {
        setShowOriginal(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "\\") setShowOriginal(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo, redo, setShowOriginal]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-ink-900">
      <NavRail />
      <main className="relative min-w-0 flex-1">
        {backend.status === "offline" && <OfflineBanner error={backend.error} onRetry={initBackend} />}
        <div className="h-full">
          {section === "home" && <HomeSection />}
          {section === "editor" && <EditorSection />}
          {section === "ai" && <AIEnhanceSection />}
          {section === "presets" && <PresetsSection />}
          {section === "settings" && <SettingsSection />}
        </div>
      </main>
    </div>
  );
}

function OfflineBanner({ error, onRetry }: { error?: string; onRetry: () => void }) {
  return (
    <div className="absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-ember/40 bg-ember/15 px-4 py-2 text-sm text-mist-100 shadow-pop">
      <IconAlert width={16} height={16} className="text-ember" />
      <span>
        Processing engine not reachable{error ? ` — ${error}` : ""}.
      </span>
      <button onClick={onRetry} className="rounded bg-ink-700 px-2 py-1 text-xs hover:bg-ink-600">
        Retry
      </button>
    </div>
  );
}
