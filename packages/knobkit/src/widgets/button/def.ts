import { defineWidget, viewRef } from "@knobkit/core";

export const button = defineWidget({
  type: "button",
  state: {},
  props: { label: { default: "OK" } },
  events: { clicked: {} },
  view: viewRef(import.meta.url, "./view.js"),
});
