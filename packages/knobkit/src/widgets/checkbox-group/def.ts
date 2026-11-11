import { defineWidget, t, viewRef } from "@knobkit/core";

const checkboxGroupDef = defineWidget({
  type: "checkboxGroup",
  state: {
    value: { initial: [] as string[] },
    // the choices a handler set during a run; null until one does, and the ones it was built with apply
    options: { initial: null as string[] | null },
  },
  props: { choices: { default: [] as string[] } },
  events: { changed: { payload: t<string[]>() } },
  ops: (at) => ({ set: at("value").op("set") }),
  methods: (self) => ({
    value: () => self.at("value").get(),
    /** Replace the choices. Ticked values that are not among the new ones are dropped. */
    async setChoices(choices: string[]): Promise<void> {
      self.at("options").set(choices);
      const value = (await self.at("value").get()) ?? [];
      const kept = value.filter((v) => choices.includes(v));
      if (kept.length !== value.length) self.at("value").set(kept);
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const checkboxGroup = (opts: { choices: string[]; value?: string[] }) =>
  checkboxGroupDef({ choices: opts.choices, value: opts.value });
