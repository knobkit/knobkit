import { puRadio, puRadioOpt } from "./radio.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function RadioView({ props, state, emit, set }: ViewProps<{ value: string }, { choices: string[] }>) {
  const update = (v: string): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <div className={puRadio}>
      {props.choices.map((c) => (
        <label key={c} className={puRadioOpt}>
          <input type="radio" checked={state.value === c} onChange={() => update(c)} /> {c}
        </label>
      ))}
    </div>
  );
}
