import "./highlighted-text.css";
import { seriesPalette, useThemeVersion } from "@knobkit/core/client";
import type { ViewProps } from "@knobkit/core/client";
import type { HighlightSpan } from "./def.js";

function colorFor(label: string, colorMap: Record<string, string>, palette: string[]): string {
  if (colorMap[label]) return colorMap[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

export default function HighlightedTextView({
  state,
}: ViewProps<{ value: HighlightSpan[]; colorMap: Record<string, string> }>) {
  const spans = state.value ?? [];
  const colorMap = state.colorMap ?? {};
  useThemeVersion();
  const palette = seriesPalette();
  if (spans.length === 0) return <div className="pu-hltext-empty">—</div>;
  return (
    <div className="pu-hltext">
      {spans.map((s, i) => {
        if (!s.label) return <span key={i}>{s.text}</span>;
        const color = colorFor(s.label, colorMap, palette);
        return (
          <span
            key={i}
            className="pu-hltext-span"
            style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, borderColor: color }}
          >
            {s.text}
            <span className="pu-hltext-label" style={{ color }}>
              {s.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
