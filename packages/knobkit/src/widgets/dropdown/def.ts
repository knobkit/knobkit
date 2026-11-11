import { defineWidget, t, viewRef } from "@knobkit/core";

export type DropdownChoice = string | { value: string; label?: string };

export const choiceValue = (c: DropdownChoice | undefined): string =>
  typeof c === "string" ? c : (c?.value ?? "");

const dropdownDef = defineWidget({
  type: "dropdown",
  state: {
    value: { initial: "" },
    // the choices a handler set during a run; null until one does, and the ones it was built with apply
    options: { initial: null as DropdownChoice[] | null },
  },
  props: { choices: { default: [] as DropdownChoice[] } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({
    value: () => self.at("value").get(),
    /** Replace the choices. A selected value that is not among the new ones is cleared (to ""). */
    async setChoices(choices: DropdownChoice[]): Promise<void> {
      self.at("options").set(choices);
      const value = await self.at("value").get();
      if (value !== "" && !choices.some((c) => choiceValue(c) === value)) self.at("value").set("");
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const dropdown = (opts: { choices: DropdownChoice[]; value?: string }) =>
  dropdownDef({ choices: opts.choices, value: opts.value ?? choiceValue(opts.choices[0]) });
