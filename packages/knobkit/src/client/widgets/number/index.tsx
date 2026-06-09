import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function NumberView({ widget, state, emit, set }: ViewProps<ValueWidget<number>, { value: number }>) {
  const update = (v: number) => {
    set(["value"], v);
    emit(widget.changed(v));
  };
  return <input className="pu-input" type="number" min={widget.min as number} max={widget.max as number} value={state.value} onChange={(e) => update(e.currentTarget.valueAsNumber)} />;
}
