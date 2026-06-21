import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogWidget extends Widget<{ lines: string[]; filter: string }> {
  push(line: string): void;
  pushStyled(line: string, level?: LogLevel): void;
  setFilter(filter: string): void;
  clear(): void;
  all(): Promise<string[]>;
}

export function log(): LogWidget {
  return {
    type: "log",
    state: { lines: [], filter: "" },
    ...controls,
    push(line: string): void {
      bound(this).edit(this, "append", ["lines"], line);
    },
    pushStyled(line: string, level: LogLevel = "info"): void {
      const tag = `[${level.toUpperCase()}]`;
      const ts = new Date().toISOString();
      bound(this).edit(this, "append", ["lines"], `${tag} ${ts} ${line}`);
    },
    setFilter(filter: string): void {
      bound(this).edit(this, "set", ["filter"], filter);
    },
    clear(): void {
      bound(this).edit(this, "set", ["lines"], []);
    },
    all(): Promise<string[]> {
      return bound(this).read<string[]>(this, ["lines"]);
    },
  };
}
