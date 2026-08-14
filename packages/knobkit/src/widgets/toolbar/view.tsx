import "./toolbar.css";
import type { ViewProps } from "@knobkit/core/client";
import type { ToolbarItem } from "./def.js";

export default function ToolbarView({ state, emit }: ViewProps<{ items: ToolbarItem[] }>) {
  const items = state.items ?? [];
  const enabled = state.$enabled !== false;
  return (
    <div className="pu-toolbar">
      {items.map((item) =>
        item.separator ? (
          <span key={item.id} className="pu-toolbar-sep" />
        ) : (
          <button
            key={item.id}
            className={`pu-toolbar-btn${item.variant && item.variant !== "default" ? ` pu-toolbar-btn--${item.variant}` : ""}`}
            disabled={!enabled || item.disabled}
            onClick={() => emit("clicked", { id: item.id })}
          >
            {item.icon && <span className="pu-toolbar-icon">{item.icon}</span>}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
