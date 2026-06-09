import type { Bound, EditOp, Path } from "./bound.js";
import type { Widget } from "./types.js";

// Builds a handler-time Bound from low-level transport functions. Reads proxy to wherever the state
// lives (the client, over the socket); edits/enables are sent for the client to apply. Translates the
// widget object to its key; the handler never sees keys.
export function makeBound(opts: {
  read: (key: string, path: Path) => Promise<unknown>;
  edit: (key: string, op: EditOp, path: Path, value: unknown) => void;
  enable: (key: string, value: boolean) => void;
  busy: (key: string, value: boolean) => void;
  keyFor: (widget: Widget<any>) => string;
}): Bound {
  return {
    read<T>(widget: Widget<any>, path: Path): Promise<T> {
      return opts.read(opts.keyFor(widget), path) as Promise<T>;
    },
    edit(widget: Widget<any>, op: EditOp, path: Path, value: unknown): void {
      opts.edit(opts.keyFor(widget), op, path, value);
    },
    enable(widget: Widget<any>, value: boolean): void {
      opts.enable(opts.keyFor(widget), value);
    },
    busy(widget: Widget<any>, value: boolean): void {
      opts.busy(opts.keyFor(widget), value);
    },
    key(widget: Widget<any>): string {
      return opts.keyFor(widget);
    },
  };
}
