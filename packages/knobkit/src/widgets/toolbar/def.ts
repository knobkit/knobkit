import { defineWidget, t, viewRef } from "@knobkit/core";

export interface ToolbarItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  separator?: boolean;
}

const toolbarDef = defineWidget({
  type: "toolbar",
  state: { items: { initial: [] as ToolbarItem[] } },
  events: { clicked: { payload: t<{ id: string }>() } },
  ops: (at) => ({ setItems: at("items").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});

/** `toolbar()`, positional `toolbar(items)`, or uniform seeding `toolbar({ items })` */
export const toolbar = (itemsOrOpts?: ToolbarItem[] | { items?: ToolbarItem[] }) =>
  toolbarDef(Array.isArray(itemsOrOpts) ? { items: itemsOrOpts } : itemsOrOpts);
