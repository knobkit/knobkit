import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, trigger, waitRecorded } from "../harness/index.js";

/** the text of the tab content a user can see */
const showing = (page: Page): Promise<string[]> =>
  page.locator(".pu-tabs-panel .pu-output").evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el).visibility === "visible" && el.getBoundingClientRect().height > 0).map((el) => el.textContent ?? ""),
  );

// KNOBKIT.md task 10: a handler can bring a tab to the front
journey("t10", (j) => {
  test("a handler selects the third tab and its content is shown", async () => {
    const page = await j.open();
    expect(await showing(page)).toEqual(["content of the first tab"]);
    await page.getByRole("button", { name: "select-third" }).click();
    await expect.poll(() => showing(page)).toEqual(["content of the third tab"]);
    expect(await page.getByRole("tab", { name: "Third" }).getAttribute("aria-selected")).toBe("true");
    expect(await page.getByRole("tab", { name: "First" }).getAttribute("aria-selected")).toBe("false");
  });

  test("the user can click another tab afterwards", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "select-third" }).click();
    await expect.poll(() => showing(page)).toEqual(["content of the third tab"]);
    await page.getByRole("tab", { name: "Second" }).click();
    await expect.poll(() => showing(page)).toEqual(["content of the second tab"]);
    // a handler reads which tab the user opened, and can select again
    await trigger(page, "which");
    expect(await waitRecorded(page, "selected")).toBe(1);
    await page.getByRole("button", { name: "select-third" }).click();
    await expect.poll(() => showing(page)).toEqual(["content of the third tab"]);
  });
});
