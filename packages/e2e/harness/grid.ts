import type { Locator, Page } from "playwright";

/** A data cell of the grid, by row and column as shown (both from 0). */
export const cell = (page: Page, row: number, col: number): Locator =>
  page.locator(`.pu-table revogr-data[type="rgRow"][slot="data"] .rgCell[data-rgrow="${row}"][data-rgcol="${col}"]`).first();

/** The user types a value into a cell: click it, type, Enter. */
export async function typeInto(page: Page, row: number, col: number, text: string): Promise<void> {
  await cell(page, row, col).click();
  await page.keyboard.type(text, { delay: 30 });
  await page.keyboard.press("Enter");
}

/**
 * The user drags a row by its handle. The grid draws a line where the row will land: under the row
 * the pointer is on, or above the first row when the pointer is just over the top of the rows.
 * `under` is that row (-1: above the first).
 */
export async function dragRow(page: Page, from: number, under: number): Promise<void> {
  const handle = (await cell(page, from, 0).locator(".revo-draggable").boundingBox())!;
  const target = (await cell(page, Math.max(under, 0), 0).boundingBox())!;
  const x = handle.x + handle.width / 2;
  const startY = handle.y + handle.height / 2;
  const endY = under < 0 ? target.y - 8 : target.y + target.height / 2;
  await page.mouse.move(x, startY);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, startY + ((endY - startY) * i) / steps);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
}

/** The first column's text, top to bottom, as the grid shows it. */
export const firstColumn = (page: Page): Promise<string[]> =>
  page.locator('.pu-table revogr-data[type="rgRow"][slot="data"] .rgCell[data-rgcol="0"]').evaluateAll((els) =>
    els
      .slice()
      .sort((a, b) => Number(a.getAttribute("data-rgrow")) - Number(b.getAttribute("data-rgrow")))
      .map((el) => el.textContent ?? ""),
  );
