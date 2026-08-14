import type { ViewProps } from "@knobkit/core/client";

interface Props {
  min: number | undefined;
  max: number | undefined;
  step: number | undefined;
}

export default function NumberView({ props, state, emit, set }: ViewProps<{ value: number }, Props>) {
  const update = (v: number): void => {
    set(["value"], v); // local, so the controlled input reflects typing and reads see it
    emit("changed", v);
  };
  return (
    <input
      className="pu-input"
      type="number"
      min={props.min}
      max={props.max}
      step={props.step}
      value={state.value}
      onChange={(e) => update(e.currentTarget.valueAsNumber)}
    />
  );
}
