import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface VideoWidget extends Widget<{ src: string }> {
  autoplay: boolean;
  loop: boolean;
  set(value: string): void; // set the video source (URL or data URL)
}

export function video(opts: { autoplay?: boolean; loop?: boolean } = {}): VideoWidget {
  return {
    type: "video",
    state: { src: "" },
    autoplay: opts.autoplay ?? false,
    loop: opts.loop ?? false,
    ...controls,
    set(value: string): void {
      bound(this).edit(this, "set", ["src"], value);
    },
  };
}
