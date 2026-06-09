import type { Knobkit } from "../knobkit.js";
import type { Widget } from "../types.js";
import { col } from "./layout.js";

export const SUBAPP = "__subapp";

export function embed(app: Knobkit): Widget {
  const ws = app.config.widgets;
  const node = col(...(Array.isArray(ws) ? ws : [ws])) as Widget;
  node[SUBAPP] = app;
  return node;
}

export function collectSubapps(widgets: Widget | Widget[]): Knobkit[] {
  const out: Knobkit[] = [];
  const visit = (w: Widget): void => {
    const sub = w[SUBAPP] as Knobkit | undefined;
    if (sub) {
      out.push(sub);
      return;
    }
    for (const c of w.children ?? []) visit(c);
  };
  for (const w of Array.isArray(widgets) ? widgets : [widgets]) visit(w);
  return out;
}
