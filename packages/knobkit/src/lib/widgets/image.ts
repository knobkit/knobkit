import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface ImageWidget extends Widget<{ src: string }> {
  set(value: string): void; // set the displayed image (URL or data URL)
}

export function image(): ImageWidget {
  return {
    type: "image",
    state: { src: "" },
    ...controls,
    set(value: string): void {
      bound(this).edit(this, "set", ["src"], value);
    },
  };
}
