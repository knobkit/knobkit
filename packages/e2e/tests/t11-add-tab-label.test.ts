import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey } from "../harness/index.js";

const showing = (page: Page): Promise<string[]> =>
  page.locator(".pu-tabs-panel .pu-output").evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).visibility === "visible" && el.getBoundingClientRect().height > 0).map((el) => el.textContent ?? ""),
  );
const labels = (page: Page): Promise<string[]> => page.getByRole("tab").evaluateAll((tabs) => tabs.map((t) => t.textContent ?? ""));

// KNOBKIT.md task 11: a tab added during a run has a label
journey("t11", (j) => {
  test("one call adds a tab that shows its label and its content", async () => {
    const page = await j.open();
    expect(await labels(page)).toEqual(["First"]);
    await page.getByRole("button", { name: "add", exact: true }).click();
    await expect.poll(() => labels(page)).toEqual(["First", "Added 1"]);
    await page.getByRole("tab", { name: "Added 1" }).click();
    await expect.poll(() => showing(page)).toEqual(["content added by call 1"]);

    // and again: each added tab keeps its own label and content
    await page.getByRole("button", { name: "add", exact: true }).click();
    await expect.poll(() => labels(page)).toEqual(["First", "Added 1", "Added 2"]);
    await page.getByRole("tab", { name: "Added 2" }).click();
    await expect.poll(() => showing(page)).toEqual(["content added by call 2"]);
    await page.getByRole("tab", { name: "First" }).click();
    await expect.poll(() => showing(page)).toEqual(["content of the first tab"]);
  });
});
