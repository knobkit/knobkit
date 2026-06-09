import "./highlighted-text.css";
import type { ViewProps } from "../../view.js";
import type { HighlightSpan } from "../../../lib/widgets/highlighted-text.js";

// A fixed palette; a label with no entry in `colorMap` gets a stable color by hashing its name, so
// the same label keeps the same color across renders without the author having to pick one.
const PALETTE = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];

function colorFor(label: string, colorMap: Record<string, string>): string {
  if (colorMap[label]) return colorMap[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function HighlightedTextView({
  state,
}: ViewProps<any, { value: HighlightSpan[]; colorMap: Record<string, string> }>) {
  const spans = state.value ?? [];
  const colorMap = state.colorMap ?? {};
  if (spans.length === 0) return <div className="pu-output">—</div>;
  return (
    <div className="pu-hltext">
      {spans.map((s, i) =>
        s.label ? (
          <span
            key={i}
            className="pu-hltext-span"
            style={{ background: `${colorFor(s.label, colorMap)}22`, borderColor: colorFor(s.label, colorMap) }}
          >
            {s.text}
            <span className="pu-hltext-label" style={{ color: colorFor(s.label, colorMap) }}>
              {s.label}
            </span>
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </div>
  );
}
