import { puTerminal } from "./terminal.css.js";
import "./terminal.css"; // kept in the entry css so the frame has its chrome before the chunk lands
import { lazy, Suspense } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { TerminalProps, TerminalState } from "./xterm.js";

// xterm.js (~200KB) loads only when an app actually renders a terminal widget.
const Impl = lazy(() => import("./xterm.js"));

export default function TerminalView(props: ViewProps<TerminalState, TerminalProps>) {
  return (
    <Suspense fallback={<div className={puTerminal} style={{ minHeight: 200 }} />}>
      <Impl {...props} />
    </Suspense>
  );
}
