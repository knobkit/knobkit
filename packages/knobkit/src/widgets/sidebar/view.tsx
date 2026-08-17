import { puSidebar, puSidebarBadge, puSidebarCollapsed, puSidebarIcon, puSidebarItem, puSidebarItemSelected, puSidebarLabel, puSidebarSection, puSidebarSectionLabel, puSidebarToggle } from "./sidebar.css.js";
import { useState } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { SidebarSection } from "./def.js";

export default function SidebarView({ state, emit }: ViewProps<{ sections: SidebarSection[] }>) {
  const sections = state.sections ?? [];
  // collapse + selection highlight are presentation-only, so plain component state
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<string>();

  return (
    <nav className={`${puSidebar}${collapsed ? ` ${puSidebarCollapsed}` : ""}`}>
      <button
        className={puSidebarToggle}
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "▶" : "◀"}
      </button>
      {sections.map((section, si) => (
        <div key={si} className={puSidebarSection}>
          {!collapsed && <div className={puSidebarSectionLabel}>{section.label}</div>}
          {section.items.map((item) => (
            <button
              key={item.id}
              className={`${puSidebarItem}${selected === item.id ? ` ${puSidebarItemSelected}` : ""}`}
              onClick={() => {
                setSelected(item.id);
                emit("selected", { id: item.id });
              }}
              title={collapsed ? item.label : undefined}
            >
              {item.icon && <span className={puSidebarIcon}>{item.icon}</span>}
              {!collapsed && (
                <>
                  <span className={puSidebarLabel}>{item.label}</span>
                  {item.badge && (
                    <span className={`${puSidebarBadge}${item.badgeVariant && item.badgeVariant !== "default" ? ` pu-sidebar-badge--${item.badgeVariant}` : ""}`}>
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
