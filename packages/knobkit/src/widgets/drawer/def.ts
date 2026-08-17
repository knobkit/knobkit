import { defineWidget, viewRef } from "@knobkit/core";
import { containerMethods } from "../layout/container.js";

const drawerDef = defineWidget({
  type: "drawer",
  size: { x: "fill", y: "fill" },
  slots: "distribute",
  state: {
    items: { initial: [] as unknown[] },
    open: { initial: true }, // toggling is a view-local edit
  },
  ops: (at) => ({ setOpen: at("open").op("set") }),
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./view.js"),
});

export const drawer = (nav: unknown, main: unknown, opts: { open?: boolean } = {}) =>
  drawerDef({ items: [nav, main], open: opts.open });
