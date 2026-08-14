import { defineWidget, viewRef } from "@knobkit/core";

export type Row = Record<string, unknown>;

export const chart = defineWidget({
  type: "chart",
  state: { data: { initial: [] as Row[] } },
  props: {
    kind: { default: "bar" as "bar" | "line" | "area" },
    x: { default: "" }, // key for the category/x axis
    y: { default: "" as string | string[] }, // one or more series keys to plot
  },
  ops: (at) => ({ setData: at("data").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
