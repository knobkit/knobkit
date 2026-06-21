import "./toolbar.css";
import type { ViewProps } from "../../view.js";
import type { ToolbarWidget, ToolbarState, ToolbarItem } from "../../../lib/widgets/toolbar.js";

export function ToolbarView({ widget, state, enabled, emit }: ViewProps<ToolbarWidget, ToolbarState>) {
  const items = state.items ?? [];
  return (
    <div className="pu-toolbar">
      {items.map((item: ToolbarItem) =>
        item.separator ? (
          <span key={item.id} className="pu-toolbar-sep" />
        ) : (
          <button
            key={item.id}
            className={`pu-toolbar-btn${item.variant && item.variant !== "default" ? ` pu-toolbar-btn--${item.variant}` : ""}`}
            disabled={!enabled || item.disabled}
            onClick={() => emit(widget.clicked({ id: item.id }))}
          >
            {item.icon && <span className="pu-toolbar-icon">{item.icon}</span>}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
