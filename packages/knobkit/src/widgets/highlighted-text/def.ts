import { defineWidget, t, viewRef } from "@knobkit/core";

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
  events: {
    // the user clicked a marked span: its place among the spans, its label and its text
    clicked: { payload: t<{ index: number; label: string; text: string }>() },
    // the user selected a phrase
    selected: { payload: t<{ text: string }>() },
  },
  methods: (self) => ({
    set: (value: HighlightSpan[], colorMap?: Record<string, string>) =>
      self.at().patch(colorMap === undefined ? { value } : { value, colorMap }),
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
