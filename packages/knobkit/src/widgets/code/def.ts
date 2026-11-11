import { defineWidget, t, viewRef } from "@knobkit/core";

export const code = defineWidget({
  type: "code",
  size: { y: "fill" },
  state: {
    value: { initial: "" },
    language: { initial: "" }, // state, not prop: runtime-switchable via setLanguage()
  },
  props: { readOnly: { default: false } },
  events: {
    changed: { payload: t<string>() },
    // the user selected a phrase: where it starts and ends (characters from the start of the text), and the phrase
    selected: { payload: t<{ start: number; end: number; text: string }>() },
  },
  ops: (at) => ({
    set: at("value").op("set"),
    setLanguage: at("language").op("set"),
  }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});
