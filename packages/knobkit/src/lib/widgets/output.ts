import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface OutputWidget extends Widget<{ value: string }> {
  format: "text" | "markdown"; // how the view renders `value`; "text" is plain, "markdown" renders GFM
  set(value: string): void; // replace the displayed text
}

export function output(opts: { format?: "text" | "markdown" } = {}): OutputWidget {
  return {
    type: "output",
    state: { value: "" },
    format: opts.format ?? "text",
    ...controls,
    set(value: string): void {
      bound(this).edit(this, "set", ["value"], value);
    },
  };
}
