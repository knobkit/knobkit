import "./radio.css";
import type { ViewProps } from "@knobkit/core/client";

export default function RadioView({ props, state, emit, set }: ViewProps<{ value: string }, { choices: string[] }>) {
  const update = (v: string): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <div className="pu-radio">
      {props.choices.map((c) => (
        <label key={c} className="pu-radio-opt">
          <input type="radio" checked={state.value === c} onChange={() => update(c)} /> {c}
        </label>
      ))}
    </div>
  );
}
