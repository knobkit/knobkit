import { puSlider, puSliderVal } from "./slider.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function SliderView({ props, state, emit, set }: ViewProps<{ value: number; range: { min: number; max: number; step?: number } | null }, { min: number; max: number; step: number }>) {
  const min = state.range?.min ?? props.min;
  const max = state.range?.max ?? props.max;
  const step = state.range?.step ?? props.step;
  const update = (v: number): void => {
    set(["value"], v);
    emit("changed", v);
  };
  return (
    <div className={puSlider}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={state.value}
        onChange={(e) => update(e.currentTarget.valueAsNumber)}
      />
      <output className={puSliderVal}>{state.value}</output>
    </div>
  );
}
