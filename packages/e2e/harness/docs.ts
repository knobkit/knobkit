import { expect } from "vitest";
import type { Page } from "playwright";
import { trigger } from "./index.js";
import type { Journey } from "./index.js";

/** The document viewer's scrolling box, whatever kind it is showing. */
export const BOX = ".pu-doc-view";

export interface Net {
  /** every address the page asked for since it was opened, sockets included */
  urls: string[];
  /** fails on one that is not the app's own (`blob:` and `data:` never leave the browser) */
  expectOwn(): void;
}

/** A fresh window on the app with everything it requests written down, from the first request on. */
export async function openWatched(j: Journey): Promise<{ page: Page; net: Net }> {
  const page = await j.open();
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  page.on("websocket", (w) => urls.push(w.url()));
  await page.reload();
  await page.locator("#root .pu-field").first().waitFor();
  const own = new URL(j.url()).host;
  return {
    page,
    net: {
      urls,
      expectOwn() {
        expect(urls.length).toBeGreaterThan(0);
        const foreign = urls.filter((u) => !/^(blob|data):/.test(u) && new URL(u).host !== own);
        expect(foreign).toEqual([]);
      },
    },
  };
}

/** The tab that is open: the others' content stays on the page, out of sight. */
export const OPEN = ".pu-tabs-pane:not(.pu-tabs-pane-off)";

const READY: Record<string, string> = {
  "paper.pdf": `${BOX}[data-kind="pdf"][data-pages="15"]`,
  "paper by address": `${BOX}[data-kind="pdf"][data-pages="15"]`,
  "report.docx": `${BOX}[data-kind="docx"] section.docx`,
  "deck.pptx": `${BOX}[data-kind="pptx"]:not([data-pages="0"]) .pptx-preview-slide-wrapper`,
  "book.xlsx": `${BOX}[data-kind="xlsx"] revo-grid .rgCell`,
  "notes.md": `${OPEN} .pu-md h1`,
  "plain.txt": `${OPEN} .pu-output`,
  "data.csv": `${OPEN} .pu-table revo-grid .rgCell`,
  "pic.png": `${OPEN} img.pu-image`,
  "other.bin": `${BOX}[data-kind="other"] a`,
};

/** Have the fixture's handler show a file, and wait until it is on the page. */
export async function show(page: Page, file: string): Promise<void> {
  await trigger(page, file);
  await page.locator(READY[file]!).first().waitFor();
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Found {
  /** the boxes the passage is drawn in, one per line or piece, in window coordinates */
  rects: Rect[];
  /** how many separate pieces of text it runs over */
  pieces: number;
  /** the passage as the document holds it */
  text: string;
  /** all of it lies inside the viewer's box and the window */
  inView: boolean;
}

/**
 * Where a passage is on the page, found by walking the document's text (pieces joined as they
 * are). `within` narrows the search to one page or slide.
 */
export async function locate(page: Page, passage: string, within = BOX): Promise<Found | null> {
  return page.evaluate(
    ({ passage, within, box }) => {
      const root = document.querySelector(within);
      const host = document.querySelector(box);
      if (!root || !host) return null;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: { node: Text; start: number }[] = [];
      let all = "";
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        if (n.parentElement?.closest("style")) continue;
        nodes.push({ node: n, start: all.length });
        all += n.data;
      }
      const at = all.indexOf(passage);
      if (at < 0) return null;
      const where = (i: number): [Text, number] => {
        let k = nodes[0]!;
        for (const x of nodes) if (x.start <= i) k = x;
        return [k.node, i - k.start];
      };
      const range = document.createRange();
      range.setStart(...where(at));
      const [endNode, endOffset] = where(at + passage.length - 1);
      range.setEnd(endNode, endOffset + 1);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
      const b = host.getBoundingClientRect();
      const inView = rects.length > 0 && rects.every((r) => r.y >= Math.max(0, b.top) - 1 && r.y + r.height <= Math.min(innerHeight, b.bottom) + 1 && r.x >= b.left - 1 && r.x + r.width <= b.right + 1);
      const pieces = nodes.filter((x) => x.start < at + passage.length && x.start + x.node.data.length > at).length;
      return { rects, pieces, text: range.toString(), inView };
    },
    { passage, within, box: BOX },
  );
}

export interface Marked {
  text: string;
  rects: Rect[];
  pieces: number;
  inView: boolean;
}

/** What the viewer has highlighted (CSS Custom Highlight API), in the same terms as `locate`. */
export async function marks(page: Page): Promise<Marked[]> {
  return page.evaluate((box) => {
    const host = document.querySelector(box);
    const set = CSS.highlights.get("pu-doc-mark");
    if (!host || !set) return [];
    const b = host.getBoundingClientRect();
    return [...set].map((r) => {
      const range = r as Range;
      const rects = [...range.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5).map((q) => ({ x: q.x, y: q.y, width: q.width, height: q.height }));
      const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
      let pieces = range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? 1 : 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n) && (n as Text).data.length) pieces++;
      const inView = rects.length > 0 && rects.every((q) => q.y >= Math.max(0, b.top) - 1 && q.y + q.height <= Math.min(innerHeight, b.bottom) + 1);
      return { text: range.toString(), rects, pieces, inView };
    });
  }, BOX);
}

/**
 * How much of a region of the window is drawn in a warm colour (clearly more red than blue): the
 * highlight is one, and black text on a white page is not. Read from a real screenshot, so it is
 * what the browser painted.
 */
export async function warmth(page: Page, r: Rect): Promise<number> {
  const clip = { x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height) };
  const png = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let warm = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! - data[i + 2]! > 40) warm++;
    return warm / (data.length / 4);
  }, png.toString("base64"));
}

/** How much of a PDF page's drawing is ink (anything but near-white); 0 when the page is not drawn. */
export async function ink(page: Page, pageNumber: number): Promise<number> {
  return page.evaluate((n) => {
    const canvas = document.querySelector<HTMLCanvasElement>(`[data-page="${n}"] canvas`);
    if (!canvas || !canvas.width) return 0;
    const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i]! + data[i + 1]! + data[i + 2]! < 600 && data[i + 3]! > 0) dark++;
    return dark / (data.length / 4);
  }, pageNumber);
}

/** The user selects a passage with the mouse: press at its start, drag to its end, release. */
export async function dragOver(page: Page, found: Found): Promise<void> {
  const first = found.rects[0]!;
  const last = found.rects[found.rects.length - 1]!;
  const from = { x: first.x + 1, y: first.y + first.height / 2 };
  const to = { x: last.x + last.width - 1, y: last.y + last.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

export const squash = (s: string): string => s.replace(/\s+/g, " ").trim();
