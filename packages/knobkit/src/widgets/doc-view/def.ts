import { defineWidget, t, viewRef } from "@knobkit/core";
import type { MediaRef } from "@knobkit/core";

/** What the user selected in a document, and the page or slide it is on (1-based). */
export interface DocSelection {
  text: string;
  page: number;
}

export const docView = defineWidget({
  type: "docView",
  size: { y: "fill" },
  state: {
    src: { initial: null as MediaRef | string | null },
    /** a MIME type or a file extension; empty = worked out from the name, the address or the media type */
    type: { initial: "" },
    name: { initial: "" },
    /** the page, slide or sheet to show, from 1 */
    page: { initial: 1 },
    /** the passage to highlight, by its text; empty = none */
    mark: { initial: "" },
    // counted up by goTo() and mark(), so that asking for the same page or passage again goes there again
    went: { initial: 0 },
    marked: { initial: 0 },
  },
  events: {
    selected: { payload: t<DocSelection>() },
  },
  ops: (at) => ({
    clearMark: at("mark").op("set", ""),
  }),
  methods: (self) => ({
    /** Show a file, given as bytes (`toMedia`) or as an address. */
    show(doc: { src: MediaRef | string | null; type?: string; name?: string }): void {
      self.at().patch({ src: doc.src, type: doc.type ?? "", name: doc.name ?? "", page: 1, mark: "" });
    },
    /** Bring a page, slide or sheet into view, counted from 1. */
    goTo(page: number): void {
      self.at("page").set(page);
      self.at("went").inc(1);
    },
    /** Highlight a passage, found by its text, and bring it into view. */
    mark(text: string): void {
      self.at("mark").set(text);
      self.at("marked").inc(1);
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});
