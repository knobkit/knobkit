import { expect, test } from "vitest";
import type { Locator, Page } from "playwright";
import { journey } from "../harness/index.js";
import type { Journey } from "../harness/index.js";

/** A window in which each of the two editors' panes is 400 px wide. */
async function open400(j: Journey): Promise<Page> {
  let width = 1200;
  let page = await j.open();
  const pane = (): Promise<number> => page.locator(".pu-code").first().evaluate((el) => el.getBoundingClientRect().width);
  for (let i = 0; i < 4 && Math.abs((await pane()) - 400) > 0.5; i++) {
    width += Math.round(2 * (400 - (await pane())));
    page = await j.open({ viewport: { width, height: 700 } });
  }
  expect(Math.abs((await pane()) - 400)).toBeLessThanOrEqual(0.5);
  return page;
}

/** the long line of an editor: its length, and where its first and last letters are drawn in the pane */
const longLine = (editor: Locator) =>
  editor.evaluate((root) => {
    const scroller = root.querySelector(".cm-scroller")!;
    const line = root.querySelectorAll(".cm-line")[1]!;
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    const rectOf = (node: Text, at: number): DOMRect => {
      const r = document.createRange();
      r.setStart(node, at);
      r.setEnd(node, at + 1);
      return r.getBoundingClientRect();
    };
    const first = rectOf(nodes[0]!, 0);
    const lastNode = nodes[nodes.length - 1]!;
    const last = rectOf(lastNode, lastNode.data.length - 1);
    const pane = scroller.getBoundingClientRect();
    const inPane = (r: DOMRect): boolean => r.left >= pane.left - 0.5 && r.right <= pane.right + 0.5 && r.top >= pane.top - 0.5 && r.bottom <= pane.bottom + 0.5;
    return {
      length: (line.textContent ?? "").length,
      rows: Math.round(line.getBoundingClientRect().height / first.height),
      firstInPane: inPane(first),
      lastInPane: inPane(last),
      sideways: scroller.scrollWidth - scroller.clientWidth,
      scrollLeft: scroller.scrollLeft,
    };
  });

// KNOBKIT.md task 23: the code editor can wrap long lines
journey("t23", (j) => {
  test("with wrapping on, a 200-character line in a 400 px pane is shown in full with no sideways scrolling", async () => {
    const page = await open400(j);
    const editor = page.locator(".pu-code").nth(0);
    const l = await longLine(editor);
    expect(l.length).toBe(200);
    expect(l.sideways).toBeLessThanOrEqual(0);
    expect(l.rows).toBeGreaterThan(1);
    expect(l.firstInPane).toBe(true);
    expect(l.lastInPane).toBe(true);
    // and it cannot be scrolled sideways
    const box = (await editor.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(300, 0);
    await page.waitForTimeout(300);
    expect((await longLine(editor)).scrollLeft).toBe(0);
  });

  test("with wrapping off, the line scrolls sideways as today", async () => {
    const page = await open400(j);
    const editor = page.locator(".pu-code").nth(1);
    const before = await longLine(editor);
    expect(before.length).toBe(200);
    expect(before.rows).toBe(1);
    expect(before.sideways).toBeGreaterThan(400);
    expect(before.firstInPane).toBe(true);
    expect(before.lastInPane).toBe(false);
    // the user scrolls to the end of the line
    const box = (await editor.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(before.sideways + 50, 0);
    await expect.poll(async () => (await longLine(editor)).scrollLeft).toBeGreaterThan(400);
    const after = await longLine(editor);
    expect(after.lastInPane).toBe(true);
    expect(after.firstInPane).toBe(false);
  });
});
