import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface LayoutWidget extends Widget<{ items: string[] }> {
  children: Widget<any>[];
  add(child: Widget<any>): void;
  remove(child: Widget<any>): Promise<void>;
}

function container(type: string, children: Widget<any>[], props: Record<string, unknown> = {}): LayoutWidget {
  return {
    type,
    state: { items: [] },
    children,
    ...controls,
    add(child: Widget<any>): void {
      const b = bound(this);
      b.edit(this, "append", ["items"], b.key(child));
    },
    async remove(child: Widget<any>): Promise<void> {
      const b = bound(this);
      const key = b.key(child);
      const items = await b.read<string[]>(this, ["items"]);
      b.edit(this, "set", ["items"], items.filter((k) => k !== key));
    },
    ...props,
  };
}

export function span<W extends Widget<any>>(widget: W, amount: number | { cols?: number; rows?: number }): W {
  const spec = typeof amount === "number" ? { cols: amount } : amount;
  const w = widget as Widget<any>;
  if (spec.cols && spec.cols > 1) w.colspan = spec.cols;
  if (spec.rows && spec.rows > 1) w.rowspan = spec.rows;
  return widget;
}

export function grow<W extends Widget<any>>(widget: W): W {
  (widget as Widget<any>).grow = true;
  return widget;
}

export const row = (...children: Widget<any>[]): LayoutWidget => container("row", children);
export const col = (...children: Widget<any>[]): LayoutWidget => container("col", children);
export const grid = (children: Widget<any>[], opts: { cols?: number } = {}): LayoutWidget =>
  container("grid", children, { cols: opts.cols ?? 2 });

// Tabbed container: each panel is a labelled child. `labels` rides alongside `items` (the child keys)
// in the same order; the active tab is view-local state, so switching tabs never round-trips.
export const tabs = (panels: { label: string; content: Widget<any> }[]): LayoutWidget =>
  container(
    "tabs",
    panels.map((p) => p.content),
    { labels: panels.map((p) => p.label) },
  );

// A single collapsible section. `open` is the initial state; toggling it is view-local.
export const accordion = (opts: { label: string; open?: boolean }, ...children: Widget<any>[]): LayoutWidget =>
  container("accordion", children, { label: opts.label, open: opts.open ?? true });
