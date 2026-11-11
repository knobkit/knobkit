import { puHltext, puHltextEmpty, puHltextLabel, puHltextSpan } from "./highlighted-text.css.js";
import { useRef } from "react";
import { useSelectionReport } from "../_primitives/selection.js";
import { seriesPalette, useThemeVersion } from "@knobkit/core/client";
import type { ViewProps } from "@knobkit/core/client";
import type { HighlightSpan } from "./def.js";

function colorFor(label: string, colorMap: Record<string, string>, palette: string[]): string {
  if (colorMap[label]) return colorMap[label];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

// the selected text without the labels drawn beside the marked spans: they are not part of the text
function withoutLabels(range: Range): string {
  const part = range.cloneContents();
  part.querySelectorAll(`.${puHltextLabel}`).forEach((l) => l.remove());
  return part.textContent ?? "";
}

export default function HighlightedTextView({
  state,
  emit,
}: ViewProps<{ value: HighlightSpan[]; colorMap: Record<string, string> }>) {
  const spans = state.value ?? [];
  const root = useRef<HTMLDivElement>(null);
  useSelectionReport(root, (text) => emit("selected", { text }), withoutLabels);
  const colorMap = state.colorMap ?? {};
  useThemeVersion();
  const palette = seriesPalette();
  if (spans.length === 0) return <div className={puHltextEmpty}>—</div>;
  return (
    <div ref={root} className={puHltext}>
      {spans.map((s, i) => {
        if (!s.label) return <span key={i}>{s.text}</span>;
        const color = colorFor(s.label, colorMap, palette);
        return (
          <span
            key={i}
            className={puHltextSpan}
            onClick={() => {
              // the end of a drag that selected text is not a click on the span
              if (!document.getSelection()?.isCollapsed) return;
              emit("clicked", { index: i, label: s.label!, text: s.text });
            }}
            style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, borderColor: color }}
          >
            {s.text}
            <span className={puHltextLabel} style={{ color }}>
              {s.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
