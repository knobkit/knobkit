import { defineWidget, t, viewRef } from "@knobkit/core";

export const number = defineWidget({
  type: "number",
  state: { value: { initial: 0 } },
  props: {
    min: { default: undefined as number | undefined },
    max: { default: undefined as number | undefined },
    step: { default: undefined as number | undefined },
  },
  events: { changed: { payload: t<number>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
