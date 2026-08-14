import "./slider.css";
import type { ViewProps } from "@knobkit/core/client";

export default function SliderView({ props, state, emit, set }: ViewProps<{ value: number }, { min: number; max: number; step: number }>) {
  const update = (v: number): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <div className="pu-slider">
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={state.value}
        onChange={(e) => update(e.currentTarget.valueAsNumber)}
      />
      <output className="pu-slider-val">{state.value}</output>
    </div>
  );
}
