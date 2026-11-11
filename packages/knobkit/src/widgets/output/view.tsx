import { puOutput } from "./output.css.js";
import { lazy, Suspense, useRef } from "react";
import { useSelectionReport } from "../_primitives/selection.js";
import type { ViewProps } from "@knobkit/core/client";

// The markdown renderer (react-markdown + remark-gfm) loads as its own chunk, only when an output
// actually uses format="markdown" — plain text output stays weightless in the entry bundle.
const Markdown = lazy(() => import("./markdown.js"));

export default function OutputView({ props, state, emit }: ViewProps<{ value: string }, { format: string }>) {
  const root = useRef<HTMLDivElement>(null);
  useSelectionReport(root, (text) => emit("selected", { text }));
  const plain = <div ref={root} className={puOutput}>{state.value || "—"}</div>;
  if (props.format !== "markdown") return plain;
  return <Suspense fallback={plain}><Markdown value={state.value} rootRef={root} /></Suspense>;
}
