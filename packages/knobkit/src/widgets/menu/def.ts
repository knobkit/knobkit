import { defineWidget, t, viewRef } from "@knobkit/core";

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export const menu = defineWidget({
  type: "menu",
  state: {
    open: { initial: false },
    x: { initial: 0 },
    y: { initial: 0 },
    items: { initial: [] as MenuItem[] },
    target: { initial: null as string | null },
  },
  events: { selected: { payload: t<{ action: string; target: string | null }>() } },
  methods: (self) => ({
    open: (opts: { x: number; y: number; items: MenuItem[]; target?: string | null }) =>
      self.at().patch({ items: opts.items, target: opts.target ?? null, x: opts.x, y: opts.y, open: true }),
    close: () => self.at("open").set(false),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
