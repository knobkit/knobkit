import "./text.css";
import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function TextView({ widget, state, emit, set }: ViewProps<ValueWidget<string>, { value: string }>) {
  const lines = (widget.lines as number) ?? 1;
  const update = (v: string) => {
    set(["value"], v); // local, so the controlled input reflects typing and reads see it
    emit(widget.changed(v));
  };
  return lines > 1 ? (
    <textarea className="pu-input" rows={lines} placeholder={widget.placeholder as string} value={state.value} onChange={(e) => update(e.currentTarget.value)} />
  ) : (
    <input className="pu-input" placeholder={widget.placeholder as string} value={state.value} onChange={(e) => update(e.currentTarget.value)} />
  );
}
