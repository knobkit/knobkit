import "./html.css";
import type { ViewProps } from "@knobkit/core/client";

// The deliberate escape hatch: render author-supplied markup as-is. Trust is on the author (the same
// code that runs handlers), so this is no broader than what they already control.
export default function HtmlView({ state }: ViewProps<{ value: string }>) {
  if (!state.value) return <div className="pu-html-empty">—</div>;
  return <div className="pu-html" dangerouslySetInnerHTML={{ __html: state.value }} />;
}
