import { afterAll, beforeAll, expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, sleep } from "../harness/index.js";
import { startSite } from "../harness/site.js";
import type { Site } from "../harness/site.js";

let site: Site;
beforeAll(async () => {
  site = await startSite();
});
afterAll(() => site.close());

export const show = async (page: Page, url: string): Promise<void> => {
  await page.getByPlaceholder("address").fill(url);
  await page.getByRole("button", { name: "go", exact: true }).click();
};

// KNOBKIT.md task 13: an embedded page can be reloaded
journey("t13", (j) => {
  test("a handler's reload makes one new navigation, to the same address", async () => {
    const page = await j.open();
    const url = site.url("ok");
    const navigations: string[] = [];
    page.on("framenavigated", (f) => {
      if (f !== page.mainFrame()) navigations.push(f.url());
    });
    await show(page, url);
    await expect.poll(() => navigations).toEqual([url]);
    await page.frameLocator("iframe").locator("#where").waitFor();

    // today's way does nothing: the same address set again is not a change
    await show(page, url);
    await sleep(500);
    expect(navigations).toEqual([url]);
    // counted from here: in server mode set() itself asks the site once, for its headers
    const asked = site.hits["/ok"]!;

    await page.getByRole("button", { name: "reload" }).click();
    await expect.poll(() => navigations).toEqual([url, url]);
    await sleep(500);
    expect(navigations).toEqual([url, url]); // one, not more
    expect(site.hits["/ok"]).toBe(asked + 1); // and the site was asked again
    expect(await page.locator("iframe").getAttribute("src")).toBe(url);
  });
});
