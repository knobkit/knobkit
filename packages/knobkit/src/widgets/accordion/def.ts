import { defineWidget, viewRef } from "@knobkit/core";
import { containerMethods } from "../layout/container.js";

const accordionDef = defineWidget({
  type: "accordion",
  // open, with something inside that fills, it takes the height it is offered; otherwise it is as
  // tall as its content (shut: its header)
  size: { y: "pass" },
  slots: "distribute",
  state: {
    items: { initial: [] as unknown[] },
    open: { initial: true }, // toggling is a view-local edit
  },
  props: { label: { default: "" } },
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./view.js"),
});

export const accordion = (opts: { label: string; open?: boolean }, ...children: unknown[]) =>
  accordionDef({ items: children, open: opts.open, label: opts.label });
