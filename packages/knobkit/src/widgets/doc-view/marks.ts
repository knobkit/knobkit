import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { findText } from "./find.js";
import type { DocSelection } from "./def.js";

// One highlight for every document on the page: the stylesheet can only name a fixed one, and it
// holds any number of ranges. (CSS Custom Highlight API: nothing is added to the document, so the
// renderer's own elements are left alone.)
const HIGHLIGHT = "pu-doc-mark";

function highlight(): Highlight | null {
  if (typeof CSS === "undefined" || !("highlights" in CSS) || typeof Highlight === "undefined") return null;
  let h = CSS.highlights.get(HIGHLIGHT);
  if (!h) {
    h = new Highlight();
    CSS.highlights.set(HIGHLIGHT, h);
  }
  return h;
}

export interface PagedState {
  page: number;
  mark: string;
  went: number;
  marked: number;
}

export interface Paged {
  /** the element that holds the rendered document */
  host: RefObject<HTMLElement | null>;
  /** the page or slide elements, in order */
  pages: () => HTMLElement[];
  /** changes whenever more of the document is on the page; 0 = nothing yet */
  version: number;
  state: PagedState;
  emit: (name: "selected", payload: DocSelection) => void;
}

/**
 * What the paged kinds (PDF, Word, slides) share: going to a page, marking a passage by its text,
 * and reporting what the user selects.
 */
export function usePaged({ host, pages, version, state, emit }: Paged): void {
  const out = useRef({ pages, emit });
  out.current = { pages, emit };

  // go to a page: again when asked again, and once it exists
  const went = useRef<string | null>(null);
  useEffect(() => {
    if (!version) return;
    const key = `${state.page}:${state.went}`;
    if (went.current === key) return;
    // a document opens on its first page by itself
    if (went.current === null && state.page <= 1) {
      went.current = key;
      return;
    }
    const el = out.current.pages()[state.page - 1];
    if (!el) return; // not rendered yet: a later version brings it
    went.current = key;
    el.scrollIntoView({ block: "start", inline: "nearest" });
  }, [version, state.page, state.went]);

  // mark a passage
  const shown = useRef<{ key: string; range: Range } | null>(null);
  useEffect(() => {
    const clear = (): void => {
      if (shown.current) highlight()?.delete(shown.current.range);
      shown.current = null;
    };
    const key = `${state.mark}:${state.marked}`;
    if (!state.mark) return clear();
    if (!version || !host.current) return;
    // found already, and still in the document: more of it arriving changes nothing
    if (shown.current?.key === key && host.current.contains(shown.current.range.startContainer)) return;
    clear();
    const range = findText(host.current, state.mark);
    if (!range) return; // not on the page (yet): a later version may bring it
    highlight()?.add(range);
    shown.current = { key, range };
    range.startContainer.parentElement?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [version, state.mark, state.marked, host]);
  useEffect(
    () => () => {
      if (shown.current) highlight()?.delete(shown.current.range);
      shown.current = null;
    },
    [],
  );

  // report what the user selects, once the selection has come to rest
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pressed = false;
    let last = "";
    const report = (): void => {
      const el = host.current;
      const sel = document.getSelection();
      if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
        last = "";
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return;
      const text = sel.toString().trim();
      if (!text) return;
      const at = out.current.pages().findIndex((p) => p.contains(range.startContainer));
      const page = at < 0 ? 1 : at + 1;
      const key = `${page}:${text}`;
      if (key === last) return;
      last = key;
      out.current.emit("selected", { text, page });
    };
    const soon = (ms: number): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!pressed) report();
      }, ms);
    };
    const onChange = (): void => soon(250);
    const onDown = (): void => {
      pressed = true;
    };
    const onUp = (): void => {
      pressed = false;
      soon(0);
    };
    document.addEventListener("selectionchange", onChange);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", onChange);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, [host]);
}
