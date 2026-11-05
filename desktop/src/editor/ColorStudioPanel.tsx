import { useState } from "react";
import { useEditor } from "../store/editorStore";
import { HSL_BANDS } from "../lib/adjustments";
import type { Grade, HSLBandName, ColorWheel as WheelT, CurvePoint } from "../types";
import RangeControl from "../components/RangeControl";
import CurveEditor from "../components/CurveEditor";
import ColorWheel from "../components/ColorWheel";
import { IconImport, IconExport, IconClose } from "../components/icons";

const BAND_COLORS: Record<HSLBandName, string> = {
  red: "#ff4d4d", orange: "#ff9f45", yellow: "#ffe14d", green: "#5fd36b",
  aqua: "#4dd2cf", blue: "#5a8cff", purple: "#a97bff", magenta: "#ff6bc1",
};
const CURVE_CHANNELS: { key: keyof Grade["curves"]; label: string; color: string }[] = [
  { key: "rgb", label: "RGB", color: "#e7eaf1" },
  { key: "red", label: "R", color: "#ff6b6b" },
  { key: "green", label: "G", color: "#5fd36b" },
  { key: "blue", label: "B", color: "#5a8cff" },
];

export default function ColorStudioPanel() {
  const grade = useEditor((s) => s.adjustments.grade);
  const setGradeLive = useEditor((s) => s.setGradeLive);
  const begin = useEditor((s) => s.beginGesture);
  const end = useEditor((s) => s.endGesture);
  const resetGrade = useEditor((s) => s.resetGrade);

  const clone = () => JSON.parse(JSON.stringify(grade)) as Grade;

  return (
    <div className="lf-scroll flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-mist-500">
          Color Studio
        </span>
        <button onClick={resetGrade} className="text-[11px] text-mist-500 hover:text-forge-400">
          Reset grade
        </button>
      </div>

      <Section title="Curves" defaultOpen>
        <CurvesBlock grade={grade} clone={clone} setGradeLive={setGradeLive} begin={begin} end={end} />
      </Section>

      <Section title="HSL / Color Mixer" defaultOpen>
        <HslBlock grade={grade} clone={clone} setGradeLive={setGradeLive} begin={begin} end={end} />
      </Section>

      <Section title="Color Balance">
        <WheelsBlock grade={grade} clone={clone} setGradeLive={setGradeLive} begin={begin} end={end} />
      </Section>

      <Section title="Split Toning">
        <SplitBlock grade={grade} clone={clone} setGradeLive={setGradeLive} begin={begin} end={end} />
      </Section>

      <Section title="LUT">
        <LutBlock />
      </Section>
      <div className="h-6" />
    </div>
  );
}

type BlockProps = {
  grade: Grade;
  clone: () => Grade;
  setGradeLive: (g: Grade) => void;
  begin: () => void;
  end: () => void;
};

function CurvesBlock({ grade, clone, setGradeLive, begin, end }: BlockProps) {
  const [ch, setCh] = useState<keyof Grade["curves"]>("rgb");
  const channel = CURVE_CHANNELS.find((c) => c.key === ch)!;
  return (
    <div>
      <div className="mb-2 flex gap-1">
        {CURVE_CHANNELS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCh(c.key)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
              ch === c.key ? "bg-ink-600 text-mist-100" : "bg-ink-850 text-mist-500 hover:bg-ink-700"
            }`}
            style={ch === c.key ? { color: c.color } : undefined}
          >
            {c.label}
          </button>
        ))}
      </div>
      <CurveEditor
        points={grade.curves[ch]}
        color={channel.color}
        onStart={begin}
        onEnd={end}
        onChange={(pts: CurvePoint[]) => {
          const g = clone();
          g.curves[ch] = pts;
          setGradeLive(g);
        }}
      />
      <p className="mt-1.5 text-[10px] text-mist-500">Click to add · drag to shape · double-click a point to remove</p>
    </div>
  );
}

function HslBlock({ grade, clone, setGradeLive, begin, end }: BlockProps) {
  const [band, setBand] = useState<HSLBandName>("red");
  const b = grade.hsl[band];
  const set = (field: "hue" | "saturation" | "luminance") => (v: number) => {
    const g = clone();
    g.hsl[band][field] = v;
    setGradeLive(g);
  };
  const resetField = (field: "hue" | "saturation" | "luminance") => () => {
    begin();
    const g = clone();
    g.hsl[band][field] = 0;
    setGradeLive(g);
    end();
  };
  return (
    <div>
      <div className="mb-3 flex justify-between gap-1">
        {HSL_BANDS.map((name) => {
          const active = band === name;
          const touched = grade.hsl[name].hue || grade.hsl[name].saturation || grade.hsl[name].luminance;
          return (
            <button
              key={name}
              onClick={() => setBand(name)}
              title={name}
              className={`h-6 flex-1 rounded transition-transform ${active ? "scale-110 ring-2 ring-white/70" : ""}`}
              style={{ background: BAND_COLORS[name], outline: touched && !active ? "1px solid #fff6" : undefined }}
            />
          );
        })}
      </div>
      <RangeControl label="Hue" value={b.hue} min={-100} max={100} bipolar onStart={begin} onEnd={end} onChange={set("hue")} onReset={resetField("hue")} />
      <RangeControl label="Saturation" value={b.saturation} min={-100} max={100} bipolar onStart={begin} onEnd={end} onChange={set("saturation")} onReset={resetField("saturation")} />
      <RangeControl label="Luminance" value={b.luminance} min={-100} max={100} bipolar onStart={begin} onEnd={end} onChange={set("luminance")} onReset={resetField("luminance")} />
    </div>
  );
}

function WheelsBlock({ grade, clone, setGradeLive, begin, end }: BlockProps) {
  const zones: { key: keyof Grade["color_balance"]; label: string }[] = [
    { key: "shadows", label: "Shadows" },
    { key: "midtones", label: "Midtones" },
    { key: "highlights", label: "Highlights" },
    { key: "globe", label: "Global" },
  ];
  const setWheel = (key: keyof Grade["color_balance"]) => (w: WheelT) => {
    const g = clone();
    g.color_balance[key] = w;
    setGradeLive(g);
  };
  const setLum = (key: keyof Grade["color_balance"]) => (v: number) => {
    const g = clone();
    g.color_balance[key].luminance = v;
    setGradeLive(g);
  };
  return (
    <div className="grid grid-cols-2 gap-3">
      {zones.map((z) => (
        <div key={z.key}>
          <ColorWheel
            label={z.label}
            value={grade.color_balance[z.key]}
            onStart={begin}
            onEnd={end}
            onChange={setWheel(z.key)}
          />
          <RangeControl
            label="Lum"
            value={grade.color_balance[z.key].luminance}
            min={-100}
            max={100}
            bipolar
            onStart={begin}
            onEnd={end}
            onChange={setLum(z.key)}
          />
        </div>
      ))}
    </div>
  );
}

function SplitBlock({ grade, clone, setGradeLive, begin, end }: BlockProps) {
  const st = grade.split_tone;
  const set = (field: keyof typeof st) => (v: number) => {
    const g = clone();
    g.split_tone[field] = v;
    setGradeLive(g);
  };
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-mist-500">Shadows</div>
      <RangeControl label="Hue" value={st.shadow_hue} min={0} max={360} onStart={begin} onEnd={end} onChange={set("shadow_hue")} />
      <RangeControl label="Saturation" value={st.shadow_sat} min={0} max={100} onStart={begin} onEnd={end} onChange={set("shadow_sat")} />
      <div className="mb-1 mt-2 text-[11px] font-medium uppercase tracking-wide text-mist-500">Highlights</div>
      <RangeControl label="Hue" value={st.highlight_hue} min={0} max={360} onStart={begin} onEnd={end} onChange={set("highlight_hue")} />
      <RangeControl label="Saturation" value={st.highlight_sat} min={0} max={100} onStart={begin} onEnd={end} onChange={set("highlight_sat")} />
      <RangeControl label="Balance" value={st.balance} min={-100} max={100} bipolar onStart={begin} onEnd={end} onChange={set("balance")} />
    </div>
  );
}

function LutBlock() {
  const luts = useEditor((s) => s.luts);
  const current = useEditor((s) => s.adjustments.grade.lut_id);
  const intensity = useEditor((s) => s.adjustments.grade.lut_intensity);
  const lutError = useEditor((s) => s.lutError);
  const importLut = useEditor((s) => s.importLut);
  const selectLut = useEditor((s) => s.selectLut);
  const deleteLut = useEditor((s) => s.deleteLut);
  const exportLut = useEditor((s) => s.exportLut);
  const setGradeLive = useEditor((s) => s.setGradeLive);
  const grade = useEditor((s) => s.adjustments.grade);
  const begin = useEditor((s) => s.beginGesture);
  const end = useEditor((s) => s.endGesture);

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button onClick={() => void importLut()} className="lf-btn-subtle flex-1 text-xs">
          <IconImport width={14} height={14} /> Import .cube
        </button>
        <button onClick={() => void exportLut()} className="lf-btn-subtle flex-1 text-xs">
          <IconExport width={14} height={14} /> Export look
        </button>
      </div>
      {lutError && <p className="mb-2 text-xs text-ember">{lutError}</p>}

      {luts.length === 0 ? (
        <p className="text-[12px] text-mist-500">No LUTs imported yet.</p>
      ) : (
        <div className="space-y-1">
          {luts.map((l) => (
            <div
              key={l.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                current === l.id ? "border-forge-500 bg-forge-500/10" : "border-ink-600 bg-ink-850"
              }`}
            >
              <button
                onClick={() => selectLut(current === l.id ? null : l.id)}
                className="flex-1 truncate text-left text-mist-200"
              >
                {l.name}
                <span className="ml-1 text-mist-500">({l.dim}D·{l.size})</span>
              </button>
              <button
                onClick={() => void deleteLut(l.id)}
                className="text-mist-500 hover:text-ember"
                title="Remove LUT"
              >
                <IconClose width={13} height={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="mt-2">
          <RangeControl
            label="LUT Intensity"
            value={intensity}
            min={0}
            max={100}
            defaultValue={100}
            onStart={begin}
            onEnd={end}
            onChange={(v) => {
              const g = JSON.parse(JSON.stringify(grade)) as Grade;
              g.lut_intensity = v;
              setGradeLive(g);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="border-b border-ink-600/70">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="text-[13px] font-semibold uppercase tracking-wider text-mist-300">{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-mist-500 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3 lf-fade">{children}</div>}
    </section>
  );
}
