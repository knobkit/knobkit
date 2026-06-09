import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { Widget } from "../types.js";

export interface HighlightSpan {
  text: string;
  label?: string | null; // null/omitted => plain, unhighlighted run of text
}

export interface HighlightedTextWidget
  extends Widget<{ value: HighlightSpan[]; colorMap: Record<string, string> }> {
  // The canonical output for token classification / NER / diff: a sequence of text runs, each
  // optionally tagged with a label that colors it. `colorMap` pins a color per label; unmapped
  // labels get a stable auto color in the view.
  set(value: HighlightSpan[], colorMap?: Record<string, string>): void;
}

export function highlightedText(): HighlightedTextWidget {
  return {
    type: "highlightedText",
    state: { value: [], colorMap: {} },
    ...controls,
    set(value: HighlightSpan[], colorMap?: Record<string, string>): void {
      const b = bound(this);
      if (colorMap !== undefined) b.edit(this, "set", ["colorMap"], colorMap);
      b.edit(this, "set", ["value"], value);
    },
  };
}
