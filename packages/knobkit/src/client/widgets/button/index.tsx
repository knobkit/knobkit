import "./button.css";
import type { ViewProps } from "../../view.js";
import type { ButtonWidget, ButtonState } from "../../../lib/widgets/button.js";

export function ButtonView({ widget, state, enabled, emit }: ViewProps<ButtonWidget, ButtonState>) {
  return (
    <button className="pu-submit" disabled={!enabled} onClick={() => emit(widget.clicked())}>
      {state.label}
    </button>
  );
}
