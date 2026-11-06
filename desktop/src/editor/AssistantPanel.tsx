import { useState } from "react";
import { api } from "../lib/api";
import { useEditor } from "../store/editorStore";
import type { AssistantSuggestion } from "../types";
import { IconClose, IconSparkles } from "../components/icons";

export default function AssistantPanel() {
  const open = useEditor((s) => s.assistantOpen);
  const close = useEditor((s) => s.closeAssistant);
  const image = useEditor((s) => s.image);
  const current = useEditor((s) => s.adjustments);
  const apply = useEditor((s) => s.applyAdjustments);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AssistantSuggestion | null>(null);
  if (!open) return null;
  const submit = async () => {
    if (!image || !text.trim()) return;
    setLoading(true); setError(null); setProposal(null);
    try { setProposal(await api.assistantSuggest(image.id, text, current)); }
    catch (e) { setError(e instanceof Error ? e.message : "Suggestion failed"); }
    finally { setLoading(false); }
  };
  return <div className="lf-fade absolute left-4 top-4 z-30 flex max-h-[88%] w-[340px] flex-col lf-card shadow-pop">
    <div className="flex items-center justify-between border-b border-ink-600 p-3"><div className="flex items-center gap-2"><IconSparkles width={16} height={16} className="text-forge-400"/><span className="text-sm font-semibold text-mist-100">Lumetta Assistant</span></div><button onClick={close}><IconClose width={14} height={14}/></button></div>
    <div className="lf-scroll overflow-y-auto p-3"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Try ‘brighter and warmer with teal shadows’" className="min-h-24 w-full resize-y rounded-lg border border-ink-600 bg-ink-850 p-2 text-sm text-mist-100 outline-none focus:border-forge-500"/><button disabled={loading || !text.trim()} onClick={() => void submit()} className="lf-btn-primary mt-2 w-full justify-center disabled:opacity-50">{loading ? "Preparing suggestion…" : "Suggest edits"}</button>
      {error && <p className="mt-3 text-xs text-ember">{error}</p>}
      {proposal && <div className="mt-3 rounded-lg border border-ink-600 bg-ink-850 p-3"><div className="text-[11px] uppercase tracking-wide text-mist-500">{proposal.source === "rules" ? "Local editing rules" : "Local AI"}</div><p className="mt-1 text-sm text-mist-200">{proposal.summary}</p>{proposal.notes.map((note) => <p key={note} className="mt-2 text-xs text-mist-500">{note}</p>)}
        <div className="mt-3 flex gap-2"><button onClick={() => { apply(proposal.adjustments); setProposal(null); }} className="lf-btn-primary flex-1 justify-center text-xs">Apply</button><button onClick={() => setProposal(null)} className="lf-btn-subtle flex-1 justify-center text-xs">Discard</button></div></div>}
    </div>
  </div>;
}
