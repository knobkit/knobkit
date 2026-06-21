import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface SplitPaneState {
  items: string[];
  ratio: number;
}

export interface SplitPaneWidget extends Widget<SplitPaneState> {
  children: Widget<any>[];
  direction: "horizontal" | "vertical";
  setRatio(ratio: number): void;
}

export function splitPane(
  left: Widget<any>,
  right: Widget<any>,
  opts: { direction?: "horizontal" | "vertical"; ratio?: number } = {},
): SplitPaneWidget {
  return {
    type: "splitPane",
    state: { items: [], ratio: opts.ratio ?? 0.5 },
    children: [left, right],
    direction: opts.direction ?? "horizontal",
    ...controls,
    setRatio(ratio: number): void {
      bound(this).edit(this, "set", ["ratio"], ratio);
    },
  };
}
