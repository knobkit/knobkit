import { defineWidget, viewRef } from "@knobkit/core";

export const frame = defineWidget({
  type: "frame",
  size: { y: "fill" },
  state: {
    src: { initial: "" },
    // counts reload() calls: setting the same address again is no change, so it cannot ask for one
    reloads: { initial: 0 },
  },
  ops: (at) => ({
    set: at("src").op("set"),
    /** Load the page again, from the same address. */
    reload: at("reloads").op("inc", 1),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
