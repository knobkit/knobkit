import { defineWidget, t, viewRef } from "@knobkit/core";

export const mic = defineWidget({
  type: "mic",
  state: { live: { initial: false } },
  props: {
    every: { default: 0 }, // 0 = one clip per recording; >0 = a clip every N ms while live
    control: { default: true },
    hold: { default: true },
  },
  channels: { clip: { policy: "latest", data: t<Float32Array>() } }, // 16kHz mono PCM
  ops: (at) => ({
    start: at("live").op("set", true),
    stop: at("live").op("set", false),
  }),
  methods: (self) => ({
    live: () => self.at("live").get(),
    toggle: async () => self.at("live").set(!(await self.at("live").get())),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
