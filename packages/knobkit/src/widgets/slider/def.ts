import { defineWidget, t, viewRef } from "@knobkit/core";

const sliderDef = defineWidget({
  type: "slider",
  state: { value: { initial: 0 } },
  props: { min: { default: 0 }, max: { default: 100 }, step: { default: 1 } },
  events: { changed: { payload: t<number>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const slider = (opts: { value?: number; min?: number; max?: number; step?: number } = {}) => {
  const min = opts.min ?? 0;
  return sliderDef({ min, max: opts.max, step: opts.step, value: opts.value ?? min });
};
