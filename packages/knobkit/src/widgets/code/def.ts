import { defineWidget, t, viewRef } from "@knobkit/core";

export const code = defineWidget({
  type: "code",
  size: { y: "fill" },
  state: {
    value: { initial: "" },
    language: { initial: "" }, // state, not prop: runtime-switchable via setLanguage()
  },
  props: { readOnly: { default: false } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({
    set: at("value").op("set"),
    setLanguage: at("language").op("set"),
  }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
