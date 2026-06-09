import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface ProgressWidget extends Widget<{ value: number; label: string }> {
  // Drive a determinate bar: `value` is a 0..1 fraction, with an optional caption.
  set(value: number, label?: string): void;
}

export function progress(opts: { label?: string } = {}): ProgressWidget {
  return {
    type: "progress",
    state: { value: 0, label: opts.label ?? "" },
    ...controls,
    set(value: number, label?: string): void {
      const b = bound(this);
      b.edit(this, "set", ["value"], value);
      if (label !== undefined) b.edit(this, "set", ["label"], label);
    },
  };
}
