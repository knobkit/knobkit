import "./checkbox.css";
import type { ViewProps } from "@knobkit/core/client";

export default function CheckboxView({ props, state, emit, set }: ViewProps<{ value: boolean }, { label: string }>) {
  const update = (v: boolean): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <label className="pu-check">
      <input type="checkbox" checked={state.value} onChange={(e) => update(e.currentTarget.checked)} /> {props.label}
    </label>
  );
}
