import { defineWidget, t, viewRef } from "@knobkit/core";

export type DropdownChoice = string | { value: string; label?: string };

export const choiceValue = (c: DropdownChoice | undefined): string =>
  typeof c === "string" ? c : (c?.value ?? "");

const dropdownDef = defineWidget({
  type: "dropdown",
  state: { value: { initial: "" } },
  props: { choices: { default: [] as DropdownChoice[] } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({ value: () => self.at("value").get() }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const dropdown = (opts: { choices: DropdownChoice[]; value?: string }) =>
  dropdownDef({ choices: opts.choices, value: opts.value ?? choiceValue(opts.choices[0]) });
