import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey } from "../harness/index.js";
import type { Journey } from "../harness/index.js";
import { cell } from "../harness/grid.js";

/** A window in which the grid is exactly `width` px wide. */
async function openAt(j: Journey, width: number): Promise<Page> {
  let page = await j.open();
  const gridWidth = (): Promise<number> => page.locator(".pu-table").evaluate((el) => Math.round(el.getBoundingClientRect().width));
  const around = 1200 - (await gridWidth());
  page = await j.open({ viewport: { width: width + around, height: 600 } });
  await expect.poll(gridWidth).toBe(width);
  return page;
}

/** what a cell shows: its text, and whether the text is cut short */
const shows = (page: Page, row: number, colIndex: number) =>
  cell(page, row, colIndex).evaluate((el) => ({ text: el.textContent, cut: el.scrollWidth > el.clientWidth, width: Math.round(el.getBoundingClientRect().width) }));

// KNOBKIT.md task 19: grid columns use the space they have
journey("t19", (j) => {
  test("in a grid 681 px wide, both columns show their text in full", async () => {
    const page = await openAt(j, 681);
    await expect.poll(async () => (await shows(page, 0, 0)).cut).toBe(false);
    expect(await shows(page, 0, 0)).toMatchObject({ text: "papers/attention.pdf", cut: false });
    expect(await shows(page, 0, 1)).toMatchObject({ text: "finished", cut: false });
    // no sideways scrolling to get there
    expect(await page.locator(".pu-table revo-grid").evaluate((g) => {
      const v = g.querySelector('revogr-viewport-scroll[slot="rgCol"], .rgCol revogr-viewport-scroll') ?? g;
      return v.scrollWidth <= v.clientWidth + 1;
    })).toBe(true);
  });

  test("in a grid 150 px wide, a cut cell's full text can be read by hovering", async () => {
    const page = await openAt(j, 150);
    const first = cell(page, 0, 0);
    await expect.poll(async () => (await shows(page, 0, 0)).cut).toBe(true);
    expect(await first.getAttribute("title")).toBeNull();
    await first.hover();
    await expect.poll(() => first.getAttribute("title")).toBe("papers/attention.pdf");
    // the cell under the pointer is the one carrying it
    const box = (await first.boundingBox())!;
    expect(await page.evaluate(([x, y]) => (document.elementFromPoint(x!, y!) as HTMLElement).closest("[title]")?.getAttribute("title"), [box.x + box.width / 2, box.y + box.height / 2])).toBe("papers/attention.pdf");
    // both columns are in the 150 px: nothing is pushed out of sight
    const second = (await cell(page, 0, 1).boundingBox())!;
    const grid = (await page.locator(".pu-table").boundingBox())!;
    expect(second.x + second.width).toBeLessThanOrEqual(grid.x + grid.width + 1);
  });

  test("a cell shown in full gets no hover text", async () => {
    const page = await openAt(j, 681);
    await expect.poll(async () => (await shows(page, 0, 0)).cut).toBe(false);
    await cell(page, 0, 0).hover();
    await page.waitForTimeout(200);
    expect(await cell(page, 0, 0).getAttribute("title")).toBeNull();
  });
});
