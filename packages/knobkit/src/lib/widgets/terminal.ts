import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface TerminalState {
  buffer: string;
}

export interface TerminalWidget extends Widget<TerminalState> {
  data: EventCtor<string>;
  resized: EventCtor<{ cols: number; rows: number }>;
  write(text: string): void;
  writeln(line: string): void;
  clear(): void;
  reset(): void;
}

export function terminal(opts?: { rows?: number; cols?: number; scrollback?: number }): TerminalWidget {
  return {
    type: "terminal",
    state: { buffer: "" },
    data: event<string>("terminal.data"),
    resized: event<{ cols: number; rows: number }>("terminal.resized"),
    rows: opts?.rows ?? 24,
    cols: opts?.cols ?? 80,
    scrollback: opts?.scrollback ?? 1000,
    ...controls,
    write(text: string): void {
      bound(this).edit(this, "appendText", ["buffer"], text);
    },
    writeln(line: string): void {
      bound(this).edit(this, "appendText", ["buffer"], line + "\n");
    },
    clear(): void {
      bound(this).edit(this, "set", ["buffer"], "");
    },
    reset(): void {
      bound(this).edit(this, "set", ["buffer"], "");
    },
  };
}
