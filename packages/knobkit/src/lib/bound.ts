import type { Widget } from "./types.js";

// A path into a widget's structured state, e.g. ["messages"] or ["messages", -1, "content"].
// -1 addresses the last element of an array.
export type Path = (string | number)[];
export type EditOp = "set" | "append" | "appendText";

// A widget method like `convo.history()` or `convo.append(t)` resolves its data through `bound(w)`.
// The resolver is set by whichever runtime is executing a handler (server per-request, or mount). It
// never holds state: reads are pulled from the client on demand (one attribute at a time); writes are
// generic structured edits the client applies.
export interface Bound {
  read<T>(widget: Widget<any>, path: Path): Promise<T>;
  edit(widget: Widget<any>, op: EditOp, path: Path, value: unknown): void;
  enable(widget: Widget<any>, value: boolean): void;
  busy(widget: Widget<any>, value: boolean): void;
  key(widget: Widget<any>): string;
}

let resolve: () => Bound | undefined = () => undefined;

export function setBoundResolver(fn: () => Bound | undefined): void {
  resolve = fn;
}

export function bound(_widget: Widget<any>): Bound {
  const b = resolve();
  if (!b) throw new Error("widget method called outside a knobkit handler");
  return b;
}
