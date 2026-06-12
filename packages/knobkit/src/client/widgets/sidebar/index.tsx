import "./sidebar.css";
import { useState } from "react";
import type { ViewProps } from "../../view.js";

export function SidebarView({ widget, state, slot }: ViewProps<any, { items: string[] }>) {
  const items = state.items ?? [];
  const [open, setOpen] = useState(widget.open !== false);
  const nav = items[0];
  const main = items[1];
  return (
    <div className={`pu-sidebar${open ? "" : " pu-sidebar-collapsed"}`}>
      <div className="pu-sidebar-nav">
        <button
          className="pu-sidebar-toggle"
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "⟨⟨" : "☰"}
        </button>
        {open && nav != null && <div className="pu-sidebar-body">{slot(nav)}</div>}
      </div>
      <div className="pu-sidebar-main">{main != null ? slot(main) : null}</div>
    </div>
  );
}
