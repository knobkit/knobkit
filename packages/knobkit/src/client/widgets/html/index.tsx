import type { ViewProps } from "../../view.js";

// The deliberate escape hatch: render author-supplied markup as-is. Trust is on the author (the same
// code that runs handlers), so this is no broader than what they already control.
export function HtmlView({ state }: ViewProps<any, { value: string }>) {
  if (!state.value) return <div className="pu-output">—</div>;
  return <div className="pu-html" dangerouslySetInnerHTML={{ __html: state.value }} />;
}
