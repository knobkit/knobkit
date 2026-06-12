import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export type Point = Record<string, unknown>;

export interface ChartWidget extends Widget<{ data: Point[] }> {
  kind: "bar" | "line" | "area";
  x: string; // key for the category/x axis
  y: string | string[]; // one or more series keys to plot
  data(): Promise<Point[]>;
  setData(data: Point[]): void; // replace the plotted data
  push(point: Point): void; // append one data point (append ["data"])
}

// A read-only chart rendered by Recharts. Pure output: state is `{ data }` (an array of row objects)
// and the view reads it; nothing rounds-trips back. `x`/`y` name which keys map to the axes/series.
export function chart(opts: {
  x: string;
  y: string | string[];
  kind?: "bar" | "line" | "area";
  data?: Point[];
}): ChartWidget {
  return {
    type: "chart",
    state: { data: opts.data ?? [] },
    kind: opts.kind ?? "bar",
    x: opts.x,
    y: opts.y,
    ...controls,
    data(): Promise<Point[]> {
      return bound(this).read<Point[]>(this, ["data"]);
    },
    setData(data: Point[]): void {
      bound(this).edit(this, "set", ["data"], data);
    },
    push(point: Point): void {
      bound(this).edit(this, "append", ["data"], point);
    },
  };
}
