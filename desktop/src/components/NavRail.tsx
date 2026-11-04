import { useEditor } from "../store/editorStore";
import type { Section } from "../store/editorStore";
import {
  IconHome,
  IconSliders,
  IconSparkles,
  IconPresets,
  IconSettings,
} from "./icons";

const ITEMS: { id: Section; label: string; icon: (p: any) => JSX.Element }[] = [
  { id: "home", label: "Home", icon: IconHome },
  { id: "editor", label: "Editor", icon: IconSliders },
  { id: "ai", label: "AI Enhance", icon: IconSparkles },
  { id: "presets", label: "Presets", icon: IconPresets },
  { id: "settings", label: "Settings", icon: IconSettings },
];

export default function NavRail() {
  const section = useEditor((s) => s.section);
  const setSection = useEditor((s) => s.setSection);

  return (
    <nav className="flex w-16 shrink-0 flex-col items-center border-r border-ink-600 bg-ink-850 py-3">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-forge-400 to-forge-700">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0b0d" strokeWidth="2.2">
          <circle cx="12" cy="12" r="4" strokeLinecap="round" />
          <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              title={item.label}
              className={`group relative flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-colors ${
                active
                  ? "bg-ink-700 text-forge-400"
                  : "text-mist-500 hover:bg-ink-800 hover:text-mist-200"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-forge-500" />
              )}
              <Icon width={20} height={20} />
              <span className="mt-0.5 text-[9px] font-medium">{item.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
