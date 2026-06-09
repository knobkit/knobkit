import "./slider.css";
import type { ViewProps } from "../../view.js";
import type { ValueWidget } from "../../../lib/widgets/value.js";

export function SliderView({ widget, state, emit, set }: ViewProps<ValueWidget<number>, { value: number }>) {
  const update = (v: number) => {
    set(["value"], v); // local, so the track and read-back reflect the drag with no round-trip
    emit(widget.changed(v));
  };
  return (
    <div className="pu-slider">
      <input
        type="range"
        min={widget.min as number}
        max={widget.max as number}
        step={widget.step as number}
        value={state.value}
        onChange={(e) => update(e.currentTarget.valueAsNumber)}
      />
      <output className="pu-slider-val">{state.value}</output>
    </div>
  );
}
