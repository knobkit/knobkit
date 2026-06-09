import "./checkbox.css";
import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function CheckboxView({ widget, state, emit, set }: ViewProps<ValueWidget<boolean>, { value: boolean }>) {
  const update = (v: boolean) => {
    set(["value"], v);
    emit(widget.changed(v));
  };
  return (
    <label className="pu-check">
      <input type="checkbox" checked={state.value} onChange={(e) => update(e.currentTarget.checked)} /> {widget.label as string}
    </label>
  );
}
