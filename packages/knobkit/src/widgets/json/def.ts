import { defineWidget, viewRef } from "@knobkit/core";

export const json = defineWidget({
  type: "json",
  state: { value: { initial: null as unknown } },
  ops: (at) => ({ set: at("value").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
