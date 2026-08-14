import { defineWidget, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export const image = defineWidget({
  type: "image",
  state: { src: { initial: null as MediaRef | string | null } },
  ops: (at) => ({
    show: at("src").op("set"),
    clear: at("src").op("set", null),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
