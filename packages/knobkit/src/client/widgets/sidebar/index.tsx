import "./sidebar.css";
import type { ViewProps } from "../../view.js";
import type { SidebarWidget, SidebarState, SidebarSection, SidebarItem } from "../../../lib/widgets/sidebar.js";

export function SidebarView({ widget, state, emit }: ViewProps<SidebarWidget, SidebarState>) {
  const sections = state.sections ?? [];
  const collapsed = state.collapsed ?? false;

  return (
    <nav className={`pu-sidebar${collapsed ? " pu-sidebar--collapsed" : ""}`}>
      <button
        className="pu-sidebar-toggle"
        onClick={() => emit(widget.toggled(!collapsed))}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "▶" : "◀"}
      </button>
      {sections.map((section: SidebarSection, si: number) => (
        <div key={si} className="pu-sidebar-section">
          {!collapsed && <div className="pu-sidebar-section-label">{section.label}</div>}
          {section.items.map((item: SidebarItem) => (
            <button
              key={item.id}
              className={`pu-sidebar-item${state.selected === item.id ? " pu-sidebar-item--selected" : ""}`}
              onClick={() => emit(widget.selected({ id: item.id }))}
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
