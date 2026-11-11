import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { journey } from "../harness/index.js";

// KNOBKIT.md task 27: the file link has a drawn icon
journey("t27", (j) => {
  test("the icon is a picture, not a text character", async () => {
    const page = await j.open();
    const link = page.locator("a.pu-file");
    const icon = link.locator(".pu-file-icon");
    expect(await icon.evaluate((el) => el.tagName.toLowerCase())).toBe("svg");
    expect(await icon.locator("path").count()).toBeGreaterThan(0);
    // the only text in the link is the file's name: no U+2B73, no other symbol
    expect(await link.evaluate((el) => el.textContent)).toBe("report.csv");
    expect(await page.locator("#root").evaluate((el) => (el.textContent ?? "").includes("\u2B73"))).toBe(false);
    // it has the size of an icon and is drawn in the link's colour
    const box = (await icon.boundingBox())!;
    expect(Math.round(box.width)).toBe(16);
    expect(Math.round(box.height)).toBe(16);
    expect(await icon.evaluate((el) => getComputedStyle(el).stroke)).toBe(await link.evaluate((el) => getComputedStyle(el).color));
    // and the link still downloads the file
    expect(await link.getAttribute("download")).toBe("report.csv");
  });

  test("a screenshot of the file link shows a download icon", async () => {
    const page = await j.open();
    const link = page.locator("a.pu-file");
    const dir = join(tmpdir(), "knobkit-e2e");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `t27-file-link-${j.mode}-${j.engine}.png`), await link.screenshot());

    // the icon's pixels, read back from a screenshot of it: where is there ink?
    const shot = (await link.locator(".pu-file-icon").screenshot()).toString("base64");
    const ink = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height);
      const at = (x: number, y: number): number[] => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
      const bg = at(0, 0);
      const rows: string[] = [];
      for (let y = 0; y < height; y++) {
        let row = "";
        for (let x = 0; x < width; x++) row += at(x, y).some((v, i) => Math.abs(v - bg[i]!) > 40) ? "#" : ".";
        rows.push(row);
      }
      return { rows, width, height };
    }, shot);
    // Read the drawing row by row, from its own top: where it sits in the box can differ by a
    // pixel between a window and no window.
    const s = ink.width / 16; // device pixels per unit of the drawing
    const picture = ink.rows.join("\n");
    const count = ink.rows.map((r) => [...r].filter((c) => c === "#").length);
    const centre = (r: string): number => (r.indexOf("#") + r.lastIndexOf("#")) / 2;
    const first = count.findIndex((n) => n > 0);
    const last = count.length - 1 - [...count].reverse().findIndex((n) => n > 0);
    expect(first, picture).toBeGreaterThanOrEqual(0);
    const total = count.reduce((a, n) => a + n, 0);
    // a line drawing — not a filled or striped block
    expect(total, picture).toBeGreaterThan(20 * s * s);
    expect(total, picture).toBeLessThan(0.4 * ink.width * ink.height);

    // at the bottom, a tray: a wide band
    let trayTop = last;
    while (trayTop > first && count[trayTop - 1]! >= 9 * s) trayTop--;
    expect(count[last]!, picture).toBeGreaterThanOrEqual(9 * s);
    // clear space above it
    expect(count[trayTop - 1], picture).toBe(0);
    let arrowEnd = trayTop - 1;
    while (count[arrowEnd] === 0) arrowEnd--;
    expect(arrowEnd, picture).toBeGreaterThan(first + 6 * s);

    // above that, an arrow pointing down: a narrow shaft down the middle...
    for (let y = first; y < first + 4 * s; y++) {
      expect(count[y]!, `shaft at row ${y}\n${picture}`).toBeGreaterThan(0);
      expect(count[y]!, `shaft at row ${y}\n${picture}`).toBeLessThanOrEqual(3 * s);
      expect(Math.abs(centre(ink.rows[y]!) - (ink.width - 1) / 2), `shaft at row ${y}\n${picture}`).toBeLessThanOrEqual(1.5 * s);
    }
    // ...a head wider than the shaft, in the arrow's lower half...
    const arrow = count.slice(first, arrowEnd + 1);
    const widest = Math.max(...arrow);
    expect(widest, picture).toBeGreaterThanOrEqual(6 * s);
    expect(arrow.indexOf(widest), picture).toBeGreaterThanOrEqual(arrow.length / 2 - 1);
    // ...narrowing to a point
    expect(count[arrowEnd]!, picture).toBeLessThanOrEqual(3 * s);
    expect(Math.abs(centre(ink.rows[arrowEnd]!) - (ink.width - 1) / 2), picture).toBeLessThanOrEqual(1.5 * s);
    // the tray is wider than the head
    expect(Math.max(...count.slice(trayTop, last + 1)), picture).toBeGreaterThan(widest);
  });
});
