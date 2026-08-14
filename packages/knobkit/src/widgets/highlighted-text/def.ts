import { defineWidget, viewRef } from "@knobkit/core";

export interface HighlightSpan {
  text: string;
  /** null/omitted => plain, unhighlighted run of text */
  label?: string | null;
}

export const highlightedText = defineWidget({
  type: "highlightedText",
  state: {
    value: { initial: [] as HighlightSpan[] },
    colorMap: { initial: {} as Record<string, string> },
  },
  methods: (self) => ({
    set: (value: HighlightSpan[], colorMap?: Record<string, string>) =>
      self.at().patch(colorMap === undefined ? { value } : { value, colorMap }),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
