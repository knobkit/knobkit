// chart.css is imported by ./lazy.tsx (the static entry wrapper) so it lands in client.css.
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, BarChart, Bar, LineChart, Line, AreaChart, Area } from "recharts";
import type { ReactElement } from "react";
import type { ViewProps } from "../../view.js";
import type { ChartWidget, Point } from "../../../lib/widgets/chart.js";

const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed"]; // knobkit accent + a small palette

export function ChartView({ widget, state }: ViewProps<ChartWidget, { data: Point[] }>) {
  const kind = (widget.kind as string) ?? "bar";
  const x = widget.x as string;
  const series = Array.isArray(widget.y) ? (widget.y as string[]) : [widget.y as string];
  const height = (widget.maxHeight as number) ?? 300;
  const data = state.data;

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--pu-border, #e3e6ea)" />
      <XAxis dataKey={x} tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      <Tooltip />
      {series.length > 1 && <Legend />}
    </>
  );

  let inner: ReactElement;
  if (kind === "line") {
    inner = (
      <LineChart data={data}>
        {axes}
        {series.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} />
        ))}
      </LineChart>
    );
  } else if (kind === "area") {
    inner = (
      <AreaChart data={data}>
        {axes}
        {series.map((k, i) => (
          <Area key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} />
        ))}
      </AreaChart>
    );
  } else {
    inner = (
      <BarChart data={data}>
        {axes}
        {series.map((k, i) => (
          <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />
        ))}
      </BarChart>
    );
  }

  return (
    <div className="pu-chart">
      <ResponsiveContainer width="100%" height={height}>
        {inner}
      </ResponsiveContainer>
    </div>
  );
}
