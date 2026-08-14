import { defineWidget, t, viewRef } from "@knobkit/core";

const radioDef = defineWidget({
  type: "radio",
  state: { value: { initial: "" } },
  props: { choices: { default: [] as string[] } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const radio = (opts: { choices: string[]; value?: string }) =>
  radioDef({ choices: opts.choices, value: opts.value ?? opts.choices[0] });
