import "./terminal.css"; // kept in the entry bundle (client.css) so no /assets css chunk to serve
import { lazy, Suspense, type ComponentType } from "react";
import type { ViewProps } from "../../view.js";

// xterm.js (~200KB) loads only when an app actually renders a terminal widget.
// The registry points at this thin wrapper; the real view + xterm live in a separate chunk.
const Impl = lazy(async () => ({ default: (await import("./index.js")).TerminalView as unknown as ComponentType<ViewProps> }));

export function TerminalView(props: ViewProps) {
  return (
    <Suspense fallback={<div className="pu-terminal" style={{ minHeight: 200 }} />}>
      <Impl {...props} />
    </Suspense>
  );
}
