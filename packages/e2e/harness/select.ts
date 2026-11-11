import type { Locator, Page } from "playwright";

/**
 * The user selects a phrase with the pointer: press at its first letter, drag to its last, let go.
 * `within` is the element showing the text; the phrase may run across formatting inside it.
 */
export async function selectPhrase(page: Page, within: Locator, phrase: string): Promise<void> {
  const ends = await within.evaluate((el, wanted) => {
    // the text nodes in order, skipping what cannot be selected (labels beside marked spans)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (getComputedStyle((n as Text).parentElement!).userSelect !== "none") nodes.push(n as Text);
    }
    const all = nodes.map((n) => n.data).join("");
    const at = all.indexOf(wanted);
    if (at < 0) throw new Error(`"${wanted}" is not in "${all}"`);
    const locate = (offset: number): [Text, number] => {
      let left = offset;
      for (const n of nodes) {
        if (left <= n.data.length) return [n, left];
        left -= n.data.length;
      }
      throw new Error("offset past the text");
    };
    const edge = (offset: number, side: "start" | "end"): { x: number; y: number } => {
      // the rectangle of the letter just inside the phrase at this end
      const [n, o] = side === "start" ? locate(offset) : locate(offset);
      const r = document.createRange();
      if (side === "start") {
        const [node, off] = o === n.data.length ? locate(offset + 1) : [n, o + 1];
        const [sn, so] = o === n.data.length ? [node, off - 1] : [n, o];
        r.setStart(sn, so);
        r.setEnd(node, off);
        const b = r.getBoundingClientRect();
        return { x: b.left + 1, y: b.top + b.height / 2 };
      }
      const [sn, so] = o === 0 ? locate(offset - 1) : [n, o - 1];
      r.setStart(sn, so);
      r.setEnd(sn, so + 1);
      const b = r.getBoundingClientRect();
      return { x: b.right - 1, y: b.top + b.height / 2 };
    };
    return { from: edge(at, "start"), to: edge(at + wanted.length, "end") };
  }, phrase);
  await page.mouse.move(ends.from.x, ends.from.y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(ends.from.x + ((ends.to.x - ends.from.x) * i) / steps, ends.from.y + ((ends.to.y - ends.from.y) * i) / steps);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
}
