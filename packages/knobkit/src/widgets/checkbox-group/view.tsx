import "./checkbox-group.css";
import type { ViewProps } from "@knobkit/core/client";

export default function CheckboxGroupView({ props, state, emit, set }: ViewProps<{ value: string[] }, { choices: string[] }>) {
  const selected = state.value ?? [];
  const toggle = (c: string): void => {
    const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
    set(["value"], next);
    emit("changed", next);
  };
  return (
    <div className="pu-checkgroup">
      {props.choices.map((c) => (
        <label key={c} className="pu-checkgroup-opt">
          <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} /> {c}
        </label>
      ))}
    </div>
  );
}
