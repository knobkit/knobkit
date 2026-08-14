import { defineWidget, t, viewRef } from "@knobkit/core";

const checkboxGroupDef = defineWidget({
  type: "checkboxGroup",
  state: { value: { initial: [] as string[] } },
  props: { choices: { default: [] as string[] } },
  events: { changed: { payload: t<string[]>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const checkboxGroup = (opts: { choices: string[]; value?: string[] }) =>
  checkboxGroupDef({ choices: opts.choices, value: opts.value });
