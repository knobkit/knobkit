import "../_primitives/controls.css";
import { puInput } from "./text.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function TextView({ props, state, emit, set }: ViewProps<{ value: string }, { placeholder: string; lines: number }>) {
  const update = (v: string): void => {
    set(["value"], v); // local, so the controlled input reflects typing and reads see it
    emit("changed", v);
  };
  return props.lines > 1 ? (
    <textarea
      className={puInput}
      rows={props.lines}
      placeholder={props.placeholder}
      value={state.value}
      onChange={(e) => update(e.currentTarget.value)}
    />
  ) : (
    <input
      className={puInput}
      placeholder={props.placeholder}
      value={state.value}
      onChange={(e) => update(e.currentTarget.value)}
    />
  );
}
