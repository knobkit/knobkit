import { puInput } from "../_primitives/controls.css.js";
import type { ViewProps } from "@knobkit/core/client";
import { choiceValue } from "./def.js";
import type { DropdownChoice } from "./def.js";

export default function DropdownView({ props, state, emit, set }: ViewProps<{ value: string; options: DropdownChoice[] | null }, { choices: DropdownChoice[] }>) {
  const choices = state.options ?? props.choices;
  // nothing selected (a value cleared because its choice went away): show an empty box, not the first choice
  const none = !choices.some((c) => choiceValue(c) === state.value);
  const update = (v: string): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <select className={puInput} value={none ? "" : state.value} onChange={(e) => update(e.currentTarget.value)}>
      {none && <option value="" hidden disabled />}
      {choices.map((c) => {
        const value = choiceValue(c);
        return (
          <option key={value} value={value}>
            {typeof c === "string" ? c : (c.label ?? c.value)}
          </option>
        );
      })}
    </select>
  );
}
