import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export const webcam = defineWidget({
  type: "webcam",
  state: { live: { initial: false } },
  props: {
    every: { default: 0 }, // 0 = preview only; >0 = a frame every N ms
    preview: { default: true },
  },
  channels: { frame: { policy: "latest", data: t<MediaRef>() } }, // JPEG bytes live in the media store
  ops: (at) => ({
    start: at("live").op("set", true),
    stop: at("live").op("set", false),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
