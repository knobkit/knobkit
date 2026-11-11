import { defineWidget, t, viewRef } from "@knobkit/core";

export interface SidebarItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  badgeVariant?: "default" | "info" | "success" | "warning" | "danger";
}

export interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

const sidebarDef = defineWidget({
  type: "sidebar",
  size: { x: "intrinsic" }, // it has a width of its own: a row gives it that, not an equal share
  state: { sections: { initial: [] as SidebarSection[] } },
  events: { selected: { payload: t<{ id: string }>() } },
  ops: (at) => ({ setSections: at("sections").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const sidebar = (sections: SidebarSection[] = []) => sidebarDef({ sections });
