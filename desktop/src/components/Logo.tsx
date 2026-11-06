// The Lumetta brand mark: a camera-lens ring capturing a four-point light spark
// ("Lumetta" = light). One definition, reused by the nav rail and the home hero.

/** The icon glyph only (no tile), on `currentColor`-ish strokes. 24×24 viewBox. */
export function LumettaGlyph({ size = 24, stroke = "#0a0b0d" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
      {/* lens ring */}
      <circle cx="12" cy="12" r="8.4" />
      {/* captured light — a four-point spark */}
      <path d="M12 6.6 L13.5 10.5 L17.4 12 L13.5 13.5 L12 17.4 L10.5 13.5 L6.6 12 L10.5 10.5 Z"
            fill={stroke} stroke="none" />
    </svg>
  );
}

/** The brand mark inside its rounded gradient tile. */
export default function Logo({ size = 48 }: { size?: number }) {
  const glyph = Math.round(size * 0.54);
  const radius = Math.max(10, Math.round(size * 0.26));
  return (
    <div
      className="flex shrink-0 items-center justify-center bg-gradient-to-br from-forge-400 to-forge-700 shadow-pop"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <LumettaGlyph size={glyph} />
    </div>
  );
}
