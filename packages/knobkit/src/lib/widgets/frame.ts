import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface FrameWidget extends Widget<{ src: string; doc: string }> {
  sandbox?: string;
  title: string;
  loaded: EventCtor;
  load(url: string): void;
  show(doc: string): void;
  clear(): void;
}

export function frame(opts: { src?: string; doc?: string; sandbox?: string; title?: string } = {}): FrameWidget {
  return {
    type: "frame",
    state: { src: opts.src ?? "", doc: opts.doc ?? "" },
    sandbox: opts.sandbox,
    title: opts.title ?? "frame",
    loaded: event("frame.loaded"),
    ...controls,
    load(url: string): void {
      bound(this).edit(this, "set", ["doc"], "");
      bound(this).edit(this, "set", ["src"], url);
    },
    show(doc: string): void {
      bound(this).edit(this, "set", ["src"], "");
      bound(this).edit(this, "set", ["doc"], doc);
    },
    clear(): void {
      bound(this).edit(this, "set", ["src"], "");
      bound(this).edit(this, "set", ["doc"], "");
    },
  };
}
