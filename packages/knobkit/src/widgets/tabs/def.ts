import { defineWidget, viewRef } from "@knobkit/core";
import { containerMethods } from "../layout/container.js";

export interface TabPanel {
  label: string;
  content: unknown;
  closable?: boolean;
  badge?: string;
}

const tabsDef = defineWidget({
  type: "tabs",
  size: { x: "fill", y: "fill" },
  slots: "distribute",
  state: {
    items: { initial: [] as unknown[] },
    labels: { initial: [] as string[] },
    badges: { initial: [] as (string | null)[] },
    closable: { initial: [] as boolean[] },
  },
  methods: (self) => containerMethods(() => self.at("items")),
  view: viewRef(import.meta.url, "./view.js"),
});

export const tabs = (panels: TabPanel[], opts: { defaultClosable?: boolean } = {}) =>
  tabsDef({
    items: panels.map((p) => p.content),
    labels: panels.map((p) => p.label),
    badges: panels.map((p) => p.badge ?? null),
    closable: panels.map((p) => p.closable ?? opts.defaultClosable ?? false),
  });
