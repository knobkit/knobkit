import { defineWidget, idOf, spawnTree, viewRef } from "@knobkit/core";
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
    // which tab is open: state, so a handler can bring one to the front as well as the user
    active: { initial: 0 },
    // the label, badge and close button of a tab added during a run, by the id of its content:
    // an added tab's position is not known to the handler that adds it, its id is
    added: { initial: {} as Record<string, { label: string; badge?: string | null; closable?: boolean }> },
  },
  ops: (at) => ({ select: at("active").op("set") }),
  methods: (self) => ({
    ...containerMethods(() => self.at("items")),
    selected: () => self.at("active").get(),
    /** Add a tab at the end, with its label: the content is a widget, new or already in the app. */
    addTab(panel: TabPanel): void {
      let id: string;
      try {
        id = idOf(panel.content);
      } catch {
        id = spawnTree(panel.content);
      }
      self.at("added", id).set({ label: panel.label, badge: panel.badge ?? null, closable: panel.closable ?? false });
      self.at("items").append(id);
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const tabs = (panels: TabPanel[], opts: { defaultClosable?: boolean } = {}) =>
  tabsDef({
    items: panels.map((p) => p.content),
    labels: panels.map((p) => p.label),
    badges: panels.map((p) => p.badge ?? null),
    closable: panels.map((p) => p.closable ?? opts.defaultClosable ?? false),
  });
