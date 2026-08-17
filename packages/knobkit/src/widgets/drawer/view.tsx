import { puDrawer, puDrawerBody, puDrawerCollapsed, puDrawerMain, puDrawerNav, puDrawerToggle } from "./drawer.css.js";
import type { ViewProps } from "@knobkit/core/client";

export default function DrawerView({ state, set, slot }: ViewProps<{ items: string[]; open: boolean }>) {
  const items = state.items ?? [];
  const open = state.open !== false;
  const [nav, main] = items;
  return (
    <div className={`${puDrawer}${open ? "" : ` ${puDrawerCollapsed}`}`}>
      <div className={puDrawerNav}>
        <button
          className={puDrawerToggle}
          aria-label={open ? "Collapse drawer" : "Expand drawer"}
          aria-expanded={open}
          onClick={() => set(["open"], !open)}
        >
          {open ? "⟨⟨" : "☰"}
        </button>
        {open && nav != null && <div className={puDrawerBody}>{slot(nav)}</div>}
      </div>
      <div className={puDrawerMain}>{main != null ? slot(main) : null}</div>
    </div>
  );
}
