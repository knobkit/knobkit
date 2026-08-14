import { defineWidget, viewRef } from "@knobkit/core";

export const progress = defineWidget({
  type: "progress",
  state: { value: { initial: 0 }, label: { initial: "" } },
  methods: (self) => ({
    /** Drive a determinate bar: `value` is a 0..1 fraction, with an optional caption. */
    set(value: number, label?: string): void {
      self.at().patch(label === undefined ? { value } : { value, label });
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
