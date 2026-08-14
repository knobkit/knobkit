import "./output.css";
import { lazy, Suspense } from "react";
import type { ViewProps } from "@knobkit/core/client";

// The markdown renderer (react-markdown + remark-gfm) loads as its own chunk, only when an output
// actually uses format="markdown" — plain text output stays weightless in the entry bundle.
const Markdown = lazy(() => import("./markdown.js"));

export default function OutputView({ props, state }: ViewProps<{ value: string }, { format: string }>) {
  const plain = <div className="pu-output">{state.value || "—"}</div>;
  if (props.format !== "markdown") return plain;
  return <Suspense fallback={plain}><Markdown value={state.value} /></Suspense>;
}
