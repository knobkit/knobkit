import { defineWidget, t, viewRef } from "@knobkit/core";

const radioDef = defineWidget({
  type: "radio",
  state: {
    value: { initial: "" },
    // the choices a handler set during a run; null until one does, and the ones it was built with apply
    options: { initial: null as string[] | null },
  },
  props: { choices: { default: [] as string[] } },
  events: { changed: { payload: t<string>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({
    value: () => self.at("value").get(),
    /** Replace the choices. A selected value that is not among the new ones is cleared (to ""). */
    async setChoices(choices: string[]): Promise<void> {
      self.at("options").set(choices);
      const value = await self.at("value").get();
      if (value !== "" && !choices.includes(value)) self.at("value").set("");
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const radio = (opts: { choices: string[]; value?: string }) =>
  radioDef({ choices: opts.choices, value: opts.value ?? opts.choices[0] });
