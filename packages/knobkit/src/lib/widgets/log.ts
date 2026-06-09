import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface LogWidget extends Widget<{ lines: string[] }> {
  push(line: string): void;
  all(): Promise<string[]>;
}

export function log(): LogWidget {
  return {
    type: "log",
    state: { lines: [] },
    ...controls,
    push(line: string): void {
      bound(this).edit(this, "append", ["lines"], line);
    },
    all(): Promise<string[]> {
      return bound(this).read<string[]>(this, ["lines"]);
    },
  };
}
