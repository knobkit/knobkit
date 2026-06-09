import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface WebcamWidget extends Widget<{ live: boolean }> {
  frame: EventCtor<string>;
  toggled: EventCtor<boolean>;
  every: number;
  control: boolean;
  preview: boolean;
  facing: "user" | "environment";
  start(): void;
  stop(): void;
  toggle(): Promise<void>;
  live(): Promise<boolean>;
}

export function webcam(
  opts: { every?: number; control?: boolean; preview?: boolean; facing?: "user" | "environment" } = {},
): WebcamWidget {
  return {
    type: "webcam",
    state: { live: false },
    frame: event<string>("webcam.frame"),
    toggled: event<boolean>("webcam.toggled"),
    every: opts.every ?? 0, // 0 = preview only; >0 = a frame every N ms
    control: opts.control ?? true,
    preview: opts.preview ?? true,
    facing: opts.facing ?? "user",
    ...controls,
    start(): void {
      bound(this).edit(this, "set", ["live"], true);
    },
    stop(): void {
      bound(this).edit(this, "set", ["live"], false);
    },
    async toggle(): Promise<void> {
      const live = await bound(this).read<boolean>(this, ["live"]);
      bound(this).edit(this, "set", ["live"], !live);
    },
    live(): Promise<boolean> {
      return bound(this).read<boolean>(this, ["live"]);
    },
  };
}
