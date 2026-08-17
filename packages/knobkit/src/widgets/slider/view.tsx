import { puSlider, puSliderVal } from "./slider.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function SliderView({ props, state, emit, set }: ViewProps<{ value: number }, { min: number; max: number; step: number }>) {
  const update = (v: number): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <div className={puSlider}>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={state.value}
        onChange={(e) => update(e.currentTarget.valueAsNumber)}
      />
      <output className={puSliderVal}>{state.value}</output>
    </div>
  );
}
