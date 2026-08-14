import { defineWidget, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export const video = defineWidget({
  type: "video",
  state: { src: { initial: null as MediaRef | string | null } },
  props: { autoplay: { default: false }, loop: { default: false } },
  ops: (at) => ({ set: at("src").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});
