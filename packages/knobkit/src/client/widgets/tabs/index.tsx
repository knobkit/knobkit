import "./tabs.css";
import { useState } from "react";
import type { ViewProps } from "../../view.js";

export function TabsView({ widget, state, set, slot }: ViewProps<any, { items: string[] }>) {
  const items = state.items ?? [];
  const labels = (widget.labels as string[]) ?? [];
  const closable = (widget.closable as boolean[]) ?? [];
  const badges = (widget.badges as (string | null)[]) ?? [];
  const [active, setActive] = useState(0);
  const current = Math.min(active, Math.max(0, items.length - 1));

  function handleClose(e: React.MouseEvent, index: number) {
    e.stopPropagation();
    const next = items.filter((_: string, i: number) => i !== index);
    set(["items"], next);
    // Adjust active index after removal
    if (current >= next.length) {
      setActive(Math.max(0, next.length - 1));
    } else if (index < current) {
      setActive(current - 1);
    }
  }

  return (
    <div className="pu-tabs">
      <div className="pu-tabs-bar" role="tablist">
        {items.map((_key: string, i: number) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            className={`pu-tab${i === current ? " pu-tab-active" : ""}`}
            onClick={() => setActive(i)}
          >
            <span className="pu-tab-label">{labels[i] ?? `Tab ${i + 1}`}</span>
            {badges[i] != null && badges[i] !== "" && (
              <span className="pu-tab-badge">{badges[i]}</span>
            )}
            {closable[i] && (
              <span
                className="pu-tab-close"
                role="button"
                aria-label={`Close ${labels[i] ?? `Tab ${i + 1}`}`}
                onClick={(e) => handleClose(e, i)}
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="pu-tabs-panel">{items[current] != null ? slot(items[current]) : null}</div>
    </div>
  );
}
