import { puSubmit } from "../_primitives/controls.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function ButtonView({ props, state, emit }: ViewProps<object, { label: string }>) {
  return (
    <button className={puSubmit} disabled={state.$enabled === false} onClick={() => emit("clicked")}>
      {props.label}
    </button>
  );
}
