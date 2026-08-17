import { defineWidget, viewRef } from "@knobkit/core";
import { containerMethods } from "./container.js";

const rowDef = defineWidget({
  type: "row",
  slots: "distribute",
  state: { items: { initial: [] as unknown[] } },
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./row.js"),
});

const colDef = defineWidget({
  type: "col",
  slots: "distribute",
  state: { items: { initial: [] as unknown[] } },
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./col.js"),
});

const gridDef = defineWidget({
  type: "grid",
  slots: "distribute",
  state: { items: { initial: [] as unknown[] } },
  props: { cols: { default: 2 } },
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./grid.js"),
});

export const row = (...children: unknown[]) => rowDef({ items: children });
export const col = (...children: unknown[]) => colDef({ items: children });
export const grid = (children: unknown[], opts: { cols?: number } = {}) =>
  gridDef({ items: children, cols: opts.cols });
