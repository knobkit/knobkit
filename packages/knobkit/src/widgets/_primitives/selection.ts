import { useEffect, useRef, type RefObject } from "react";

/**
 * Report the text the user selects inside an element: once when a selection made with the pointer is
 * finished (the button is let go), or when one made another way (keyboard, touch) has settled. A
 * selection reaching outside the element is not this widget's; an empty one is not reported.
 * `textOf` reads the text of the selected range, for a widget that shows more than its text.
 */
export function useSelectionReport(root: RefObject<HTMLElement | null>, report: (text: string) => void, textOf?: (range: Range) => string): void {
  const cb = useRef(report);
  cb.current = report;
  const read = useRef(textOf);
  read.current = textOf;
  useEffect(() => {
    let down = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = "";
    const check = (): void => {
      const el = root.current;
      const sel = document.getSelection();
      if (down) return; // still being dragged out: the pointer's release reports it
      if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) {
        last = "";
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      const text = read.current ? read.current(range) : sel.toString();
      if (!text.trim() || text === last) return;
      last = text;
      cb.current(text);
    };
    const soon = (ms: number): void => {
      clearTimeout(timer);
      timer = setTimeout(check, ms);
    };
    const onDown = (e: MouseEvent): void => {
      down = !!root.current?.contains(e.target as Node);
    };
    const onUp = (): void => {
      if (!down) return;
      down = false;
      soon(0);
    };
    const onChange = (): void => {
      if (!down) soon(250);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [root]);
}
