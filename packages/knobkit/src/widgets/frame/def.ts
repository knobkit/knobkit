import { defineWidget, viewRef } from "@knobkit/core";

export const frame = defineWidget({
  type: "frame",
  size: { y: "fill" },
  state: { src: { initial: "" } },
  ops: (at) => ({ set: at("src").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
