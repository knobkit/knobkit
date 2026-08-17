import { puToolbar, puToolbarBtn, puToolbarIcon, puToolbarSep } from "./toolbar.css.js";
import type { ViewProps } from "@knobkit/core/client";
import type { ToolbarItem } from "./def.js";

export default function ToolbarView({ state, emit }: ViewProps<{ items: ToolbarItem[] }>) {
  const items = state.items ?? [];
  const enabled = state.$enabled !== false;
  return (
    <div className={puToolbar}>
      {items.map((item) =>
        item.separator ? (
          <span key={item.id} className={puToolbarSep} />
        ) : (
          <button
            key={item.id}
            className={`${puToolbarBtn}${item.variant && item.variant !== "default" ? ` pu-toolbar-btn--${item.variant}` : ""}`}
            disabled={!enabled || item.disabled}
            onClick={() => emit("clicked", { id: item.id })}
          >
            {item.icon && <span className={puToolbarIcon}>{item.icon}</span>}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
