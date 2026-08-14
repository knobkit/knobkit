import { defineWidget, t, viewRef } from "@knobkit/core";

export const checkbox = defineWidget({
  type: "checkbox",
  state: { value: { initial: false } },
  props: { label: { default: "" } },
  events: { changed: { payload: t<boolean>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
