import { defineWidget, t, viewRef } from "@knobkit/core";

export const text = defineWidget({
  type: "text",
  state: { value: { initial: "" } },
  props: { placeholder: { default: "" }, lines: { default: 1 } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
