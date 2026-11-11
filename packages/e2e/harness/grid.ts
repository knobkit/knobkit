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
