import { defineWidget, t, viewRef } from "@knobkit/core";

export const output = defineWidget({
  type: "output",
  size: { y: "fill" },
  state: { value: { initial: "" } },
  props: { format: { default: "text" as "text" | "markdown" } },
  events: { selected: { payload: t<{ text: string }>() } }, // the user selected a phrase
  ops: (at) => ({
    set: at("value").op("set"),
    append: at("value").op("appendText"),
    clear: at("value").op("set", ""),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
