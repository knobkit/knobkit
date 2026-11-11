import { puHtml, puHtmlEmpty } from "./html.css.js";
import { useRef } from "react";
import { useSelectionReport } from "../_primitives/selection.js";
import type { ViewProps } from "@knobkit/core/client";

// The deliberate escape hatch: render author-supplied markup as-is. Trust is on the author (the same
// code that runs handlers), so this is no broader than what they already control.
export default function HtmlView({ state, emit }: ViewProps<{ value: string }>) {
  const root = useRef<HTMLDivElement>(null);
  useSelectionReport(root, (text) => emit("selected", { text }));
  if (!state.value) return <div className={puHtmlEmpty}>—</div>;
  return <div ref={root} className={puHtml} dangerouslySetInnerHTML={{ __html: state.value }} />;
}
