import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface ToolbarItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
  separator?: boolean;
}

export interface ToolbarState {
  items: ToolbarItem[];
}

export interface ToolbarWidget extends Widget<ToolbarState> {
  clicked: EventCtor<{ id: string }>;
  setItems(items: ToolbarItem[]): void;
  setItemDisabled(id: string, disabled: boolean): Promise<void>;
}

export function toolbar(items: ToolbarItem[] = []): ToolbarWidget {
  return {
    type: "toolbar",
    state: { items },
    clicked: event<{ id: string }>("toolbar.clicked"),
    ...controls,
    setItems(items: ToolbarItem[]): void {
      bound(this).edit(this, "set", ["items"], items);
    },
    async setItemDisabled(id: string, disabled: boolean): Promise<void> {
      const b = bound(this);
      const items = await b.read<ToolbarItem[]>(this, ["items"]);
      b.edit(this, "set", ["items"], items.map((it) => it.id === id ? { ...it, disabled } : it));
    },
  };
}
