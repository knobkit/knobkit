import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface CodeWidget extends Widget<{ value: string; language: string }> {
  changed: EventCtor<string>;
  editable: boolean;
  wrap: boolean;
  value(): Promise<string>;
  set(value: string): void;
  setLanguage(language: string): void;
}

export function code(
  opts: { value?: string; language?: string; editable?: boolean; wrap?: boolean } = {},
): CodeWidget {
  return {
    type: "code",
    state: { value: opts.value ?? "", language: opts.language ?? "" },
    changed: event<string>("code.changed"),
    editable: opts.editable ?? true,
    wrap: opts.wrap ?? false,
    ...controls,
    value(): Promise<string> {
      return bound(this).read<string>(this, ["value"]);
    },
    set(value: string): void {
      bound(this).edit(this, "set", ["value"], value);
    },
    setLanguage(language: string): void {
      bound(this).edit(this, "set", ["language"], language);
    },
  };
}
