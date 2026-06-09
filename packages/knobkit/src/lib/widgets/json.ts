import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface JsonWidget extends Widget<{ value: unknown }> {
  set(value: unknown): void; // replace the displayed value
}

export function json(): JsonWidget {
  return {
    type: "json",
    state: { value: null },
    ...controls,
    set(value: unknown): void {
      bound(this).edit(this, "set", ["value"], value);
    },
  };
}
