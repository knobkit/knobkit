import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface ValueWidget<S> extends Widget<{ value: S }> {
  changed: EventCtor<S>;
  value(): Promise<S>; // read the current input value
  set(value: S): void; // set it programmatically
}

// A self-managing value input: it holds a single `value` attribute; its view (in `client`) edits that
// value locally as the user types and emits `changed` for handlers that care.
export function value<S>(type: string, initial: S, props: Record<string, unknown> = {}): ValueWidget<S> {
  return {
    type,
    state: { value: initial },
    changed: event<S>(`${type}.changed`),
    ...controls,
    value(): Promise<S> {
      return bound(this).read<S>(this, ["value"]);
    },
    set(v: S): void {
      bound(this).edit(this, "set", ["value"], v);
    },
    ...props,
  };
}
