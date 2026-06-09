import "./tabs.css";
import { useState } from "react";
import type { ViewProps } from "../../view.js";

export function TabsView({ widget, state, slot }: ViewProps<any, { items: string[] }>) {
  const items = state.items ?? [];
  const labels = (widget.labels as string[]) ?? [];
  const [active, setActive] = useState(0);
  const current = Math.min(active, Math.max(0, items.length - 1));
  return (
    <div className="pu-tabs">
      <div className="pu-tabs-bar" role="tablist">
        {items.map((_key, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            className={`pu-tab${i === current ? " pu-tab-active" : ""}`}
            onClick={() => setActive(i)}
          >
            {labels[i] ?? `Tab ${i + 1}`}
          </button>
        ))}
      </div>
      <div className="pu-tabs-panel">{items[current] != null ? slot(items[current]) : null}</div>
    </div>
  );
}
