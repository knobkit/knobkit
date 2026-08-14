import { defineWidget, viewRef } from "@knobkit/core";

export interface LabelClass {
  label: string;
  score: number; // 0..1
}

export const label = defineWidget({
  type: "label",
  state: { label: { initial: "" }, confidences: { initial: [] as LabelClass[] } },
  methods: (self) => ({
    // A bare label, or per-class confidences (rendered as bars); when only confidences are given,
    // the top-scoring class becomes the headline label.
    set(value: string | { label?: string; confidences?: LabelClass[] }): void {
      const v = typeof value === "string" ? { label: value, confidences: [] as LabelClass[] } : value;
      const top =
        v.label ??
        (v.confidences && v.confidences.length > 0
          ? v.confidences.reduce((a, c) => (c.score > a.score ? c : a)).label
          : undefined);
      const partial: { label?: string; confidences?: LabelClass[] } = {};
      if (v.confidences !== undefined) partial.confidences = v.confidences;
      if (top !== undefined) partial.label = top;
      self.at().patch(partial);
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
