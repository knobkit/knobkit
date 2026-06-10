import "./highlighted-text.css";
import type { ViewProps } from "../../view.js";
import type { HighlightSpan } from "../../../lib/widgets/highlighted-text.js";
import { seriesPalette, useThemeVersion } from "../../theme.js";

function colorFor(label: string, colorMap: Record<string, string>, palette: string[]): string {
  if (colorMap[label]) return colorMap[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export function HighlightedTextView({
  state,
}: ViewProps<any, { value: HighlightSpan[]; colorMap: Record<string, string> }>) {
  const spans = state.value ?? [];
  const colorMap = state.colorMap ?? {};
  useThemeVersion();
  const palette = seriesPalette();
  if (spans.length === 0) return <div className="pu-output">—</div>;
  return (
    <div className="pu-hltext">
      {spans.map((s, i) =>
        s.label ? (
          <span
            key={i}
            className="pu-hltext-span"
            style={{ background: `${colorFor(s.label, colorMap, palette)}22`, borderColor: colorFor(s.label, colorMap, palette) }}
          >
            {s.text}
            <span className="pu-hltext-label" style={{ color: colorFor(s.label, colorMap, palette) }}>
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
