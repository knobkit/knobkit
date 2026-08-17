import { puInput } from "../_primitives/controls.css.js";
import type { ViewProps } from "@knobkit/core/client";
import { choiceValue } from "./def.js";
import type { DropdownChoice } from "./def.js";

export default function DropdownView({ props, state, emit, set }: ViewProps<{ value: string }, { choices: DropdownChoice[] }>) {
  const update = (v: string): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <select className={puInput} value={state.value} onChange={(e) => update(e.currentTarget.value)}>
      {props.choices.map((c) => {
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
