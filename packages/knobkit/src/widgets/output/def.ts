import { defineWidget, viewRef } from "@knobkit/core";

export const output = defineWidget({
  type: "output",
  state: { value: { initial: "" } },
  props: { format: { default: "text" as "text" | "markdown" } },
  ops: (at) => ({
    set: at("value").op("set"),
    append: at("value").op("appendText"),
    clear: at("value").op("set", ""),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
