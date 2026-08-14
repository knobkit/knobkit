import { defineWidget, viewRef } from "@knobkit/core";
import { containerMethods } from "../layout/container.js";

const splitPaneDef = defineWidget({
  type: "splitPane",
  state: {
    items: { initial: [] as unknown[] },
    ratio: { initial: 0.5 }, // state, not prop: the view drags it locally
  },
  props: { direction: { default: "horizontal" as "horizontal" | "vertical" } },
  ops: (at) => ({ setRatio: at("ratio").op("set") }),
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./view.js"),
});

export const splitPane = (
  left: unknown,
  right: unknown,
  opts: { direction?: "horizontal" | "vertical"; ratio?: number } = {},
) => splitPaneDef({ items: [left, right], ratio: opts.ratio, direction: opts.direction });
