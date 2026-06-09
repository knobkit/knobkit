import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface HtmlWidget extends Widget<{ value: string }> {
  set(value: string): void; // replace the rendered HTML (the escape hatch for custom markup)
}

export function html(opts: { value?: string } = {}): HtmlWidget {
  return {
    type: "html",
    state: { value: opts.value ?? "" },
    ...controls,
    set(value: string): void {
      bound(this).edit(this, "set", ["value"], value);
    },
  };
}
