import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface AudioWidget extends Widget<{ src: string }> {
  autoplay: boolean;
  set(value: string): void; // set the audio source (URL or data URL)
}

export function audio(opts: { autoplay?: boolean } = {}): AudioWidget {
  return {
    type: "audio",
    state: { src: "" },
    autoplay: opts.autoplay ?? false,
    ...controls,
    set(value: string): void {
      bound(this).edit(this, "set", ["src"], value);
    },
  };
}
