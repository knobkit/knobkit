import { defineWidget, t, viewRef } from "@knobkit/core";

export const html = defineWidget({
  type: "html",
  state: { value: { initial: "" } },
  events: { selected: { payload: t<{ text: string }>() } }, // the user selected a phrase
  ops: (at) => ({ set: at("value").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
