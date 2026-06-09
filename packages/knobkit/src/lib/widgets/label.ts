import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface LabelClass {
  label: string;
  score: number; // 0..1
}

export interface LabelWidget extends Widget<{ label: string; confidences: LabelClass[] }> {
  // The classifier result: either a bare label, or a label with per-class confidences (rendered as
  // bars). When only confidences are given, the top-scoring class becomes the headline label.
  set(value: string | { label?: string; confidences?: LabelClass[] }): void;
}

export function label(): LabelWidget {
  return {
    type: "label",
    state: { label: "", confidences: [] },
    ...controls,
    set(value: string | { label?: string; confidences?: LabelClass[] }): void {
      const v = typeof value === "string" ? { label: value, confidences: [] as LabelClass[] } : value;
      const b = bound(this);
      if (v.confidences !== undefined) b.edit(this, "set", ["confidences"], v.confidences);
      const top = v.label ?? v.confidences?.reduce((a, c) => (c.score > a.score ? c : a), v.confidences[0])?.label;
      if (top !== undefined) b.edit(this, "set", ["label"], top);
    },
  };
}
