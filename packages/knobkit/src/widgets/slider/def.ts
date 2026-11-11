import { defineWidget, t, viewRef } from "@knobkit/core";

const sliderDef = defineWidget({
  type: "slider",
  state: {
    value: { initial: 0 },
    // the range a handler set during a run; null until one does, and the one it was built with applies
    range: { initial: null as { min: number; max: number; step?: number } | null },
  },
  props: { min: { default: 0 }, max: { default: 100 }, step: { default: 1 } },
  events: { changed: { payload: t<number>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({
    value: () => self.at("value").get(),
    /** Replace the range (and the step, when given). A value outside the new range moves to its nearer end. */
    async setRange(min: number, max: number, step?: number): Promise<void> {
      self.at("range").set(step === undefined ? { min, max } : { min, max, step });
      const value = await self.at("value").get();
      const inside = Math.min(max, Math.max(min, value));
      if (inside !== value) self.at("value").set(inside);
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const slider = (opts: { value?: number; min?: number; max?: number; step?: number } = {}) => {
  const min = opts.min ?? 0;
  return sliderDef({ min, max: opts.max, step: opts.step, value: opts.value ?? min });
};
