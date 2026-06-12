import "./table.css"; // kept in the entry bundle (client.css) so no /assets css chunk to serve
import { lazy, Suspense, type ComponentType } from "react";
import type { ViewProps } from "../../view.js";
import { cssVar } from "../../theme.js";

// RevoGrid is a heavy web-component grid; load it only when an app actually renders a table widget.
// TableView narrows ViewProps internally; the registry hands it the generic shape, so widen here.
const Impl = lazy(async () => ({ default: (await import("./index.js")).TableView as unknown as ComponentType<ViewProps> }));

// mirror index.tsx's fit math so the loading placeholder is the grid's real height — no layout jump
// when the chunk resolves (can't import the constants from index.js without pulling it into the entry)
const fitHeight = (props: ViewProps): number => {
  const rows = (props.state as { rows?: unknown[] }).rows ?? [];
  const pane = parseInt(cssVar("--pu-pane"), 10);
  const cap = Number.isFinite(pane) && pane > 0 ? pane : 440;
  return Math.min(cap, 45 + rows.length * 32 + 2);
};

export function TableView(props: ViewProps) {
  return (
    <Suspense fallback={<div className="pu-table" style={{ height: fitHeight(props) }} />}>
      <Impl {...props} />
    </Suspense>
  );
}
