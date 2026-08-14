import { defineWidget, viewRef } from "@knobkit/core";

export const html = defineWidget({
  type: "html",
  state: { value: { initial: "" } },
  ops: (at) => ({ set: at("value").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
