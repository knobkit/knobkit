import "./sidebar.css";
import { useState } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { SidebarSection } from "./def.js";

export default function SidebarView({ state, emit }: ViewProps<{ sections: SidebarSection[] }>) {
  const sections = state.sections ?? [];
  // collapse + selection highlight are presentation-only, so plain component state
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<string>();

  return (
    <nav className={`pu-sidebar${collapsed ? " pu-sidebar--collapsed" : ""}`}>
      <button
        className="pu-sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "▶" : "◀"}
      </button>
      {sections.map((section, si) => (
        <div key={si} className="pu-sidebar-section">
          {!collapsed && <div className="pu-sidebar-section-label">{section.label}</div>}
          {section.items.map((item) => (
            <button
              key={item.id}
              className={`pu-sidebar-item${selected === item.id ? " pu-sidebar-item--selected" : ""}`}
              onClick={() => {
                setSelected(item.id);
                emit("selected", { id: item.id });
              }}
              title={collapsed ? item.label : undefined}
            >
              {item.icon && <span className="pu-sidebar-icon">{item.icon}</span>}
              {!collapsed && (
                <>
                  <span className="pu-sidebar-label">{item.label}</span>
                  {item.badge && (
                    <span className={`pu-sidebar-badge${item.badgeVariant && item.badgeVariant !== "default" ? ` pu-sidebar-badge--${item.badgeVariant}` : ""}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
