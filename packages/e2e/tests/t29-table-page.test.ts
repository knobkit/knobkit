import { expect, test } from "vitest";
import { journey } from "../harness/index.js";
import { cell } from "../harness/grid.js";

// a table on a page that does not fill the window has its own height
journey("t29", (j) => {
  test("on an ordinary page the grid is as tall as its rows, up to its ceiling", async () => {
    const page = await j.open();
    await expect.poll(() => cell(page, 3, 0).first().isVisible()).toBe(true);
    const heights = await page.locator(".pu-table revo-grid").evaluateAll((grids) => grids.map((g) => Math.round(g.getBoundingClientRect().height)));
    // header 45 + four rows of 32 + 2; and the long one stops at its maxHeight and scrolls
    expect(heights).toEqual([175, 300]);
    expect(await cell(page, 3, 0).first().innerText()).toBe("quinces");
  });
});
