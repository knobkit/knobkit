import "./drawer.css";
import type { ViewProps } from "@knobkit/core/client";

export default function DrawerView({ state, set, slot }: ViewProps<{ items: string[]; open: boolean }>) {
  const items = state.items ?? [];
  const open = state.open !== false;
  const [nav, main] = items;
  return (
    <div className={`pu-drawer${open ? "" : " pu-drawer-collapsed"}`}>
      <div className="pu-drawer-nav">
        <button
          className="pu-drawer-toggle"
          aria-label={open ? "Collapse drawer" : "Expand drawer"}
          aria-expanded={open}
          onClick={() => set(["open"], !open)}
        >
          {open ? "⟨⟨" : "☰"}
        </button>
        {open && nav != null && <div className="pu-drawer-body">{slot(nav)}</div>}
      </div>
      <div className="pu-drawer-main">{main != null ? slot(main) : null}</div>
    </div>
  );
}
