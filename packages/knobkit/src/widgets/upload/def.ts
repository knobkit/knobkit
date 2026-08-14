import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

export const upload = defineWidget({
  type: "upload",
  state: { value: { initial: null as MediaRef | null } },
  props: { label: { default: "" } },
  events: { picked: { payload: t<MediaRef>() } },
  ops: (at) => ({ clear: at("value").op("set", null) }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
