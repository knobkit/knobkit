import "./output.css";
import { lazy, Suspense } from "react";
import type { ViewProps } from "../../view.js";
import type { OutputWidget } from "../../../lib/widgets/output.js";

// The markdown renderer (react-markdown + remark-gfm) loads as its own /assets chunk, only when an
// output actually uses format="markdown" — plain text output stays weightless in the entry bundle.
const Markdown = lazy(() => import("./markdown.js"));

export function OutputView({ widget, state }: ViewProps<OutputWidget, { value: string }>) {
  const format = (widget.format as string) ?? "text";
  const plain = <div className="pu-output">{state.value || "—"}</div>;
  if (format !== "markdown") return plain;
  return (
    <Suspense fallback={plain}>
      <Markdown value={state.value} />
    </Suspense>
  );
}
