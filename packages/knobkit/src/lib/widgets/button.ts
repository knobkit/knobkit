import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface ButtonState {
  label: string;
}

export interface ButtonWidget extends Widget<ButtonState> {
  clicked: EventCtor;
  set(patch: Partial<ButtonState>): void;
}

// state is the label it shows; whether it's interactive is the framework-level enabled flag (controls)
export function button(opts: { label: string }): ButtonWidget {
  return {
    type: "button",
    state: { label: opts.label },
    clicked: event("button.clicked"),
    ...controls,
    set(patch: Partial<ButtonState>): void {
      const rt = bound(this);
      for (const [k, v] of Object.entries(patch)) rt.edit(this, "set", [k], v);
    },
  };
}
