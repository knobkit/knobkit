import "./radio.css";
import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function RadioView({ widget, state, emit, set }: ViewProps<ValueWidget<string>, { value: string }>) {
  const choices = (widget.choices as string[]) ?? [];
  const update = (v: string) => {
    set(["value"], v);
    emit(widget.changed(v));
  };
  return (
    <div className="pu-radio">
      {choices.map((c) => (
        <label key={c} className="pu-radio-opt">
          <input type="radio" checked={state.value === c} onChange={() => update(c)} /> {c}
        </label>
      ))}
    </div>
  );
}
