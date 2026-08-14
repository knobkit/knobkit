import "./button.css";
import type { ViewProps } from "@knobkit/core/client";

export default function ButtonView({ props, state, emit }: ViewProps<object, { label: string }>) {
  return (
    <button className="pu-submit" disabled={state.$enabled === false} onClick={() => emit("clicked")}>
      {props.label}
    </button>
  );
}
