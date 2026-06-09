import "./code.css"; // kept in the entry bundle (client.css) so no /assets css chunk to serve
import { lazy, Suspense, type ComponentType } from "react";
import type { ViewProps } from "../../view.js";

// CodeMirror (~300KB core + grammar chunks) loads only when an app actually renders a code widget.
// The registry points at this thin wrapper; the real view + CodeMirror live in a separate chunk.
// CodeView narrows ViewProps internally; the registry hands it the generic shape, so widen here.
const Impl = lazy(async () => ({ default: (await import("./index.js")).CodeView as unknown as ComponentType<ViewProps> }));

export function CodeView(props: ViewProps) {
  return (
    <Suspense fallback={<div className="pu-code" />}>
      <Impl {...props} />
    </Suspense>
  );
}
