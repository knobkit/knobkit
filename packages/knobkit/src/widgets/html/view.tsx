import { puHtml, puHtmlEmpty } from "./html.css.js";
import type { ViewProps } from "@knobkit/core/client";

// The deliberate escape hatch: render author-supplied markup as-is. Trust is on the author (the same
// code that runs handlers), so this is no broader than what they already control.
export default function HtmlView({ state }: ViewProps<{ value: string }>) {
  if (!state.value) return <div className={puHtmlEmpty}>—</div>;
  return <div className={puHtml} dangerouslySetInnerHTML={{ __html: state.value }} />;
}
