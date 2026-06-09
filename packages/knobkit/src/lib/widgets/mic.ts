import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface MicWidget extends Widget<{ live: boolean }> {
  clip: EventCtor<Float32Array>;
  toggled: EventCtor<boolean>;
  every: number;
  control: boolean;
  hold: boolean;
  start(): void;
  stop(): void;
  toggle(): Promise<void>;
  live(): Promise<boolean>;
}

export function mic(opts: { every?: number; control?: boolean; hold?: boolean } = {}): MicWidget {
  return {
    type: "mic",
    state: { live: false },
    clip: event<Float32Array>("mic.clip"),
    toggled: event<boolean>("mic.toggled"),
    every: opts.every ?? 0,
    control: opts.control ?? true,
    hold: opts.hold ?? true,
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
