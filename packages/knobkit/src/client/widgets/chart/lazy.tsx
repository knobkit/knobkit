import "./chart.css"; // kept in the entry bundle (client.css) so no /assets css chunk to serve
import { lazy, Suspense, type ComponentType } from "react";
import type { ViewProps } from "../../view.js";

// Recharts is sizeable; load it only when an app actually renders a chart widget.
const Impl = lazy(async () => ({ default: (await import("./index.js")).ChartView as unknown as ComponentType<ViewProps> }));

export function ChartView(props: ViewProps) {
  return (
    <Suspense fallback={<div className="pu-chart" />}>
      <Impl {...props} />
    </Suspense>
  );
}
