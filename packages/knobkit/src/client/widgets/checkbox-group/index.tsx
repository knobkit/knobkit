import "./checkbox-group.css";
import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function CheckboxGroupView({ widget, state, emit, set }: ViewProps<ValueWidget<string[]>, { value: string[] }>) {
  const choices = (widget.choices as string[]) ?? [];
  const selected = state.value ?? [];
  const toggle = (c: string) => {
    const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c];
    set(["value"], next);
    emit(widget.changed(next));
  };
  return (
    <div className="pu-checkgroup">
      {choices.map((c) => (
        <label key={c} className="pu-checkgroup-opt">
          <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} /> {c}
        </label>
      ))}
    </div>
  );
}
