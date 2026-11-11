import type { Locator, Page } from "playwright";

/**
 * One way to drive and measure the two text widgets, so the same checks run on both: the code
 * editor (CodeMirror) and the multi-line text box (a textarea).
 */
export interface TextTarget {
  /** the element that takes the keyboard */
  focusable: Locator;
  /** put the cursor at a 1-based line and column, the way a user does: keys */
  place(line: number, column: number): Promise<void>;
  cursor(): Promise<{ line: number; column: number }>;
  selection(): Promise<{ from: number; to: number }>;
  scrollTop(): Promise<number>;
  /** scroll so that the given 1-based line is at the top */
  scrollToLine(line: number): Promise<void>;
}

// On macOS Home and End scroll without moving the cursor, so the cursor keys differ by platform.
const MAC = process.platform === "darwin";
const DOC_START = MAC ? "Meta+ArrowUp" : "Control+Home";
const LINE_START = MAC ? "Meta+ArrowLeft" : "Home";

async function keysTo(page: Page, focusable: Locator, line: number, column: number): Promise<void> {
  await focusable.click();
  await page.keyboard.press(DOC_START);
  for (let i = 1; i < line; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press(LINE_START);
  for (let i = 1; i < column; i++) await page.keyboard.press("ArrowRight");
}

export function codeEditor(page: Page): TextTarget {
  const root = page.locator(".pu-code").first();
  const content = root.locator(".cm-content");
  const scroller = root.locator(".cm-scroller");
  // CodeMirror draws only the lines in view, so positions are asked of the editor's own state
  // (the view hangs off its content element) rather than read from the page's text.
  const ask = <T>(fn: string): Promise<T> =>
    content.evaluate((el, body) => {
      const view = (el as unknown as { cmTile: { view: any } }).cmTile.view;
      return new Function("view", body)(view);
    }, fn) as Promise<T>;
  return {
    focusable: content,
    place: (line, column) => keysTo(page, content, line, column),
    cursor: () =>
      ask(`const h = view.state.selection.main.head; const l = view.state.doc.lineAt(h); return { line: l.number, column: h - l.from + 1 };`),
    selection: () => ask(`const s = view.state.selection.main; return { from: s.from, to: s.to };`),
    scrollTop: () => scroller.evaluate((el) => el.scrollTop),
    async scrollToLine(line) {
      const box = (await scroller.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const lineHeight = await ask<number>(`return view.defaultLineHeight;`);
      await page.mouse.wheel(0, Math.round((line - 1) * lineHeight - (await scroller.evaluate((el) => el.scrollTop))));
      await page.waitForTimeout(300);
    },
  };
}

export function textBox(page: Page): TextTarget {
  const box = page.locator("textarea.pu-input").first();
  const pos = (which: "selectionStart" | "selectionEnd"): Promise<{ line: number; column: number }> =>
    box.evaluate((el, w) => {
      const t = el as HTMLTextAreaElement;
      const before = t.value.slice(0, t[w as "selectionStart"]);
      const line = before.split("\n").length;
      return { line, column: before.length - before.lastIndexOf("\n") };
    }, which);
  return {
    focusable: box,
    place: (line, column) => keysTo(page, box, line, column),
    cursor: () => pos("selectionEnd"),
    selection: () => box.evaluate((el) => ({ from: (el as HTMLTextAreaElement).selectionStart, to: (el as HTMLTextAreaElement).selectionEnd })),
    scrollTop: () => box.evaluate((el) => el.scrollTop),
    async scrollToLine(line) {
      const b = (await box.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      const lineHeight = await box.evaluate((el) => el.scrollHeight / (el as HTMLTextAreaElement).value.split("\n").length);
      await page.mouse.wheel(0, Math.round((line - 1) * lineHeight - (await box.evaluate((el) => el.scrollTop))));
      await page.waitForTimeout(300);
    },
  };
}
