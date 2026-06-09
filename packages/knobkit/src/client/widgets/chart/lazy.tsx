import "./chart.css"; // kept in the entry bundle (client.css) so no /assets css chunk to serve
import { lazy, Suspense, type ComponentType } from "react";
import type { ViewProps } from "../../view.js";

// Recharts is sizeable; load it only when an app actually renders a chart widget.
const Impl = lazy(async () => ({ default: (await import("./index.js")).ChartView as unknown as ComponentType<ViewProps> }));

export function ChartView(props: ViewProps) {
  const height = ((props.widget as { maxHeight?: number }).maxHeight ?? 300) + 16; // + container padding
  return (
    <Suspense fallback={<div className="pu-chart" style={{ height }} />}>
      <Impl {...props} />
    </Suspense>
  );
}
