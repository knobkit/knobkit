import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

type MenuState = { open: boolean; x: number; y: number; items: MenuItem[]; target: string | null };

export interface MenuWidget extends Widget<MenuState> {
  selected: EventCtor<{ action: string; target: string | null }>;
  open(opts: { x: number; y: number; items: MenuItem[]; target?: string | null }): void;
  close(): void;
}

export function menu(): MenuWidget {
  return {
    type: "menu",
    state: { open: false, x: 0, y: 0, items: [], target: null },
    selected: event<{ action: string; target: string | null }>("menu.selected"),
    ...controls,
    open(opts: { x: number; y: number; items: MenuItem[]; target?: string | null }): void {
      const b = bound(this);
      b.edit(this, "set", ["items"], opts.items);
      b.edit(this, "set", ["target"], opts.target ?? null);
      b.edit(this, "set", ["x"], opts.x);
      b.edit(this, "set", ["y"], opts.y);
      b.edit(this, "set", ["open"], true);
    },
    close(): void {
      bound(this).edit(this, "set", ["open"], false);
    },
  };
}
