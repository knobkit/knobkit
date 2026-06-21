import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

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

export interface SidebarState {
  sections: SidebarSection[];
  selected?: string;
  collapsed: boolean;
}

export interface SidebarWidget extends Widget<SidebarState> {
  selected: EventCtor<{ id: string }>;
  toggled: EventCtor<boolean>;
  setSections(sections: SidebarSection[]): void;
  setSelected(id: string): void;
  setCollapsed(collapsed: boolean): void;
}

export function sidebar(
  sections: SidebarSection[] = [],
  opts: { collapsed?: boolean } = {},
): SidebarWidget {
  return {
    type: "sidebar",
    state: { sections, selected: undefined, collapsed: opts.collapsed ?? false },
    selected: event<{ id: string }>("sidebar.selected"),
    toggled: event<boolean>("sidebar.toggled"),
    ...controls,
    setSections(sections: SidebarSection[]): void {
      bound(this).edit(this, "set", ["sections"], sections);
    },
    setSelected(id: string): void {
      bound(this).edit(this, "set", ["selected"], id);
    },
    setCollapsed(collapsed: boolean): void {
      bound(this).edit(this, "set", ["collapsed"], collapsed);
    },
  };
}
