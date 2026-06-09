import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function DropdownView({ widget, state, emit, set }: ViewProps<ValueWidget<string>, { value: string }>) {
  const choices = (widget.choices as string[]) ?? [];
  const update = (v: string) => {
    set(["value"], v);
    emit(widget.changed(v));
  };
  return (
    <select className="pu-input" value={state.value} onChange={(e) => update(e.currentTarget.value)}>
      {choices.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
