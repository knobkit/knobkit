import type { Density, Theme } from "./theme.js";
import { COLSPAN, DENSITY, GROW, ROWSPAN, THEME } from "./types.js";
import { internalOf } from "./widget.js";

function stamp(h: unknown): Record<string, unknown> {
  const internal = internalOf(h);
  if (internal.id) {
    throw new Error(`knobkit: layout modifiers apply before the widget joins the app ("${internal.def.type}" already has an id)`);
  }
  return internal.props;
}

/** In a row/grid, claim more than one slot: `span(w, 2)` or `span(w, { cols, rows })`. */
export function span<W>(w: W, amount: number | { cols?: number; rows?: number }): W {
  const spec = typeof amount === "number" ? { cols: amount } : amount;
  const props = stamp(w);
  if (spec.cols && spec.cols > 1) props[COLSPAN] = spec.cols;
  if (spec.rows && spec.rows > 1) props[ROWSPAN] = spec.rows;
  return w;
}

/** In a col, mark the child that absorbs the leftover space. */
export function grow<W>(w: W): W {
  stamp(w)[GROW] = true;
  return w;
}

/** Scoped density override — tokens re-resolve for this widget's subtree. */
export function density<W>(w: W, level: Density): W {
  stamp(w)[DENSITY] = level;
  return w;
}

/** Scoped color-theme override for this widget's subtree. */
export function theme<W>(w: W, mode: Theme): W {
  stamp(w)[THEME] = mode;
  return w;
}
