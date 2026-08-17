import { puTab, puTabActive, puTabBadge, puTabClose, puTabLabel, puTabs, puTabsBar, puTabsPanel } from "./tabs.css.js";
import { useState } from "react";
import type { ViewProps } from "@knobkit/core/client";

interface TabsState {
  items: string[];
  labels: string[];
  badges: (string | null)[];
  closable: boolean[];
}

export default function TabsView({ state, set, slot }: ViewProps<TabsState>) {
  const { items = [], labels = [], badges = [], closable = [] } = state;
  const [active, setActive] = useState(0);
  const current = Math.min(active, Math.max(0, items.length - 1));

  function handleClose(e: React.MouseEvent, index: number): void {
    e.stopPropagation();
    set(["items"], items.filter((_, i) => i !== index));
    if (current >= items.length - 1) setActive(Math.max(0, items.length - 2));
    else if (index < current) setActive(current - 1);
  }

  return (
    <div className={puTabs}>
      <div className={puTabsBar} role="tablist">
        {items.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            className={`${puTab}${i === current ? ` ${puTabActive}` : ""}`}
            onClick={() => setActive(i)}
          >
            <span className={puTabLabel}>{labels[i] ?? `Tab ${i + 1}`}</span>
            {badges[i] != null && badges[i] !== "" && <span className={puTabBadge}>{badges[i]}</span>}
            {closable[i] && (
              <span
                className={puTabClose}
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
      <div className={puTabsPanel}>{items[current] != null ? slot(items[current]) : null}</div>
    </div>
  );
}
