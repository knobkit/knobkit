import { puTab, puTabActive, puTabBadge, puTabClose, puTabLabel, puTabs, puTabsBar, puTabsPane, puTabsPaneOff, puTabsPanel } from "./tabs.css.js";
import { useRef } from "react";
import type { ViewProps } from "@knobkit/core/client";

interface TabsState {
  items: string[];
  labels: string[];
  badges: (string | null)[];
  closable: boolean[];
  active: number;
  added: Record<string, { label: string; badge?: string | null; closable?: boolean }>;
}

export default function TabsView({ state, set, slot }: ViewProps<TabsState>) {
  const { items = [], added = {} } = state;
  // a tab made with the app has its label by position; one added during a run, by its content's id
  const labels = items.map((id, i) => added[id]?.label ?? state.labels?.[i]);
  const badges = items.map((id, i) => (added[id] ? added[id].badge : state.badges?.[i]) ?? null);
  const closable = items.map((id, i) => (added[id] ? added[id].closable : state.closable?.[i]) ?? false);
  const setActive = (index: number): void => set(["active"], index);
  const current = Math.min(Math.max(0, state.active ?? 0), Math.max(0, items.length - 1));

  // A tab's content is drawn when the tab is first opened and then stays on the page, out of
  // sight, while another tab is open. Taking it off the page loses what only the page holds: a
  // video's position, an embedded page's document, an editor's cursor and scroll.
  const opened = useRef(new Set<string>());
  if (items[current] != null) opened.current.add(items[current]);
  for (const id of opened.current) if (!items.includes(id)) opened.current.delete(id);

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
      <div className={puTabsPanel}>
        {items.map((id, i) =>
          opened.current.has(id) ? (
            <div key={id} role="tabpanel" className={`${puTabsPane}${i === current ? "" : ` ${puTabsPaneOff}`}`} aria-hidden={i !== current}>
              {slot(id)}
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
