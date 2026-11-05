import { useEditor } from "../store/editorStore";
import type { PortraitAdjust } from "../types";
import RangeControl from "../components/RangeControl";
import { IconFace, IconClose, IconCheck, IconReset, IconAlert } from "../components/icons";

type Field = keyof PortraitAdjust;
interface Ctl {
  field: Field;
  label: string;
  min: number;
  max: number;
  bipolar?: boolean;
  def?: number;
}
const GROUPS: { title: string; controls: Ctl[] }[] = [
  {
    title: "Skin",
    controls: [
      { field: "skin_smoothing", label: "Skin Smoothing", min: 0, max: 100 },
      { field: "texture_preservation", label: "Texture Preservation", min: 0, max: 100, def: 55 },
      { field: "blemish_removal", label: "Blemish Removal", min: 0, max: 100 },
    ],
  },
  {
    title: "Eyes",
    controls: [
      { field: "eye_enhance", label: "Eye Enhance", min: 0, max: 100 },
      { field: "eye_brightness", label: "Eye Brightness", min: 0, max: 100 },
      { field: "under_eye", label: "Under-eye Reduction", min: 0, max: 100 },
    ],
  },
  { title: "Mouth", controls: [{ field: "teeth_whiten", label: "Teeth Whitening", min: 0, max: 100 }] },
  {
    title: "Face",
    controls: [
      { field: "face_exposure", label: "Facial Exposure", min: -100, max: 100, bipolar: true },
      { field: "face_sharpen", label: "Face Sharpening", min: 0, max: 100 },
      { field: "face_noise_reduction", label: "Face Noise Reduction", min: 0, max: 100 },
    ],
  },
  { title: "Hair", controls: [{ field: "hair_enhance", label: "Hair Enhancement", min: 0, max: 100 }] },
  {
    title: "Background",
    controls: [
      { field: "background_exposure", label: "Background Exposure", min: -100, max: 100, bipolar: true },
      { field: "background_saturation", label: "Background Saturation", min: -100, max: 100, bipolar: true },
    ],
  },
];

export default function PortraitPanel() {
  const portrait = useEditor((s) => s.portrait);
  const params = useEditor((s) => s.adjustments.portrait);
  const setPortraitMode = useEditor((s) => s.setPortraitMode);
  const setPortraitField = useEditor((s) => s.setPortraitField);
  const applyPortrait = useEditor((s) => s.applyPortrait);
  const cancelPortrait = useEditor((s) => s.cancelPortrait);

  if (!portrait.open) return null;

  const hasFaces = portrait.faceCount > 0;

  return (
    <div className="lf-fade absolute left-4 top-4 z-30 flex max-h-[88%] w-[300px] flex-col lf-card shadow-pop">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-forge-500/15 text-forge-400">
            <IconFace width={16} height={16} />
          </div>
          <span className="text-sm font-semibold text-mist-100">Portrait Studio</span>
          {portrait.detecting && (
            <span className="lf-spin h-3.5 w-3.5 rounded-full border-2 border-forge-400 border-t-transparent" />
          )}
        </div>
        <button onClick={cancelPortrait} title="Cancel" className="flex h-6 w-6 items-center justify-center rounded text-mist-500 hover:bg-ink-700 hover:text-mist-200">
          <IconClose width={14} height={14} />
        </button>
      </div>

      <div className="lf-scroll flex-1 overflow-y-auto p-3">
        {portrait.detecting ? (
          <p className="py-4 text-center text-sm text-mist-500">Detecting faces…</p>
        ) : !hasFaces ? (
          <div className="py-3">
            <p className="flex items-start gap-2 text-sm text-mist-400">
              <IconAlert width={16} height={16} className="mt-0.5 shrink-0 text-forge-400" />
              <span>{portrait.message || "No faces detected."}</span>
            </p>
            {!portrait.modelAvailable && (
              <p className="mt-2 text-xs text-mist-500">
                The face-detection model isn't installed. Connect to the internet once to
                download it, or add it in Settings.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between rounded-md bg-teal/10 px-2.5 py-1.5 text-xs text-teal">
              <span className="flex items-center gap-1.5">
                <IconCheck width={13} height={13} />
                {portrait.faceCount} face{portrait.faceCount === 1 ? "" : "s"} detected
              </span>
            </div>

            <label className="mb-1 block text-[11px] uppercase tracking-wide text-mist-500">Mode</label>
            <select
              value={portrait.mode}
              onChange={(e) => setPortraitMode(e.target.value)}
              className="mb-3 w-full rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-xs text-mist-200"
            >
              {portrait.modes.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>

            {GROUPS.map((g) => (
              <div key={g.title} className="mb-1">
                <div className="mb-0.5 mt-2 text-[11px] font-medium uppercase tracking-wide text-mist-500">
                  {g.title}
                </div>
                {g.controls.map((c) => (
                  <RangeControl
                    key={c.field}
                    label={c.label}
                    value={params[c.field] as number}
                    min={c.min}
                    max={c.max}
                    bipolar={c.bipolar}
                    defaultValue={c.def ?? 0}
                    onChange={(v) => setPortraitField(c.field, v)}
                    onReset={() => setPortraitField(c.field, c.def ?? 0)}
                  />
                ))}
              </div>
            ))}

            <div className="mt-3 border-t border-ink-600 pt-2">
              <RangeControl label="Intensity" value={params.intensity} min={0} max={100}
                defaultValue={100} onChange={(v) => setPortraitField("intensity", v)} />
              <RangeControl label="Naturalness" value={params.naturalness} min={0} max={100}
                defaultValue={70} onChange={(v) => setPortraitField("naturalness", v)} />
            </div>
          </>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-ink-600 p-3">
        <button onClick={applyPortrait} disabled={!hasFaces} className="lf-btn-primary flex-1 disabled:opacity-50">
          <IconCheck width={16} height={16} /> Apply
        </button>
        <button onClick={cancelPortrait} className="lf-btn-subtle" title="Discard">
          <IconReset width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
