import { useEffect, useState } from "react";
import { useEditor } from "../store/editorStore";
import type { RawParams, RawWbMode, DemosaicAlgo } from "../types";
import RangeControl from "../components/RangeControl";
import { IconChip } from "../components/icons";

const DEFAULT: RawParams = {
  wb_mode: "camera",
  exposure: 0,
  highlight_mode: 0,
  demosaic: "AHD",
  noise_reduction: 0,
};

const WB: { id: RawWbMode; label: string }[] = [
  { id: "camera", label: "Camera" },
  { id: "auto", label: "Auto" },
  { id: "daylight", label: "Daylight" },
];
const HL: { v: number; label: string }[] = [
  { v: 0, label: "Clip" },
  { v: 2, label: "Blend" },
  { v: 5, label: "Recover" },
];
const NR: { v: number; label: string }[] = [
  { v: 0, label: "Off" },
  { v: 1, label: "Light" },
  { v: 2, label: "Full" },
];
const DEMOSAIC: DemosaicAlgo[] = ["AHD", "VNG", "DCB", "AAHD", "LMMSE"];

export default function RawDevelopPanel() {
  const image = useEditor((s) => s.image);
  const developing = useEditor((s) => s.developing);
  const rawDevelop = useEditor((s) => s.rawDevelop);
  const [open, setOpen] = useState(true);
  const [params, setParams] = useState<RawParams>(image?.raw_params ?? DEFAULT);

  // keep local params synced when switching images
  useEffect(() => {
    setParams(image?.raw_params ?? DEFAULT);
  }, [image?.id]);

  if (!image?.is_raw) return null;

  const commit = (next: RawParams) => {
    setParams(next);
    void rawDevelop(next);
  };

  return (
    <section className="border-b border-ink-600 bg-ink-850/60">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-forge-300">
          <IconChip width={14} height={14} /> RAW Develop
          {developing && <span className="lf-spin h-3 w-3 rounded-full border-2 border-forge-400 border-t-transparent" />}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-mist-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 lf-fade">
          <Seg label="White Balance" options={WB.map((w) => [w.id, w.label])} value={params.wb_mode}
               onPick={(v) => commit({ ...params, wb_mode: v as RawWbMode })} />

          <RangeControl
            label="RAW Exposure (EV)"
            value={params.exposure}
            min={-2}
            max={3}
            step={0.1}
            bipolar
            onChange={(v) => setParams((p) => ({ ...p, exposure: v }))}
            onEnd={() => commit(params)}
            onReset={() => commit({ ...params, exposure: 0 })}
          />

          <Seg label="Highlights" options={HL.map((h) => [String(h.v), h.label])} value={String(params.highlight_mode)}
               onPick={(v) => commit({ ...params, highlight_mode: parseInt(v) })} />

          <Seg label="RAW Noise Reduction" options={NR.map((n) => [String(n.v), n.label])} value={String(params.noise_reduction)}
               onPick={(v) => commit({ ...params, noise_reduction: parseInt(v) })} />

          <div className="mt-2">
            <div className="mb-1 text-[12px] text-mist-300">Demosaic</div>
            <select
              value={params.demosaic}
              onChange={(e) => commit({ ...params, demosaic: e.target.value as DemosaicAlgo })}
              className="w-full rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-xs text-mist-200"
            >
              {DEMOSAIC.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-mist-500">
            16-bit develop via LibRaw. These re-decode the sensor data; fine tuning
            is done with the sliders below. The original RAW is never modified.
          </p>
        </div>
      )}
    </section>
  );
}

function Seg({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-[12px] text-mist-300">{label}</div>
      <div className="flex gap-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            onClick={() => onPick(v)}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
              value === v ? "bg-forge-500 text-ink-900" : "bg-ink-700 text-mist-300 hover:bg-ink-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
