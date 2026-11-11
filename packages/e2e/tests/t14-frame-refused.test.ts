import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, sleep, waitRecorded } from "../harness/index.js";
import { startSite } from "../harness/site.js";
import type { Site } from "../harness/site.js";

const ARXIV = "https://arxiv.org/abs/1412.6980";
const WIKIPEDIA = "https://en.wikipedia.org/wiki/Attention_Is_All_You_Need";

let site: Site;
beforeAll(async () => {
  site = await startSite();
});
afterAll(() => site.close());

const show = async (page: Page, url: string): Promise<number> => {
  await page.getByPlaceholder("address").fill(url);
  const at = Date.now();
  await page.getByRole("button", { name: "go", exact: true }).click();
  return at;
};
const refusal = (page: Page) => page.locator(".pu-frame-refused");

// KNOBKIT.md task 14: the embedded page handles a site that refuses to be embedded
journey("t14", (j) => {
  test("every embedded page has a control that opens its address in a new window", async () => {
    const page = await j.open();
    await show(page, ARXIV);
    const control = page.getByRole("link", { name: "Open in a new window" });
    await control.waitFor();
    const [opened] = await Promise.all([j.context().waitForEvent("page"), control.click()]);
    await opened.waitForURL(ARXIV);
    expect(opened.url()).toBe(ARXIV);
    expect(opened).not.toBe(page);

    // a page that can be embedded has the same control
    await show(page, site.url("ok"));
    await page.frameLocator("iframe").locator("#where").waitFor();
    expect(await control.getAttribute("href")).toBe(site.url("ok"));
    expect(await control.isVisible()).toBe(true);
  });

  if (j.mode === "serve") {
    describe("server mode", () => {
      test("arxiv.org: within 5 s the pane says the site does not allow this, and the handler receives refused", async () => {
        const page = await j.open();
        const at = await show(page, ARXIV);
        await refusal(page).waitFor({ timeout: 5000 });
        expect(await waitRecorded(page, "refused", 1, 5000 - (Date.now() - at))).toEqual({ src: ARXIV });
        expect(Date.now() - at).toBeLessThanOrEqual(5000);
        expect(await refusal(page).textContent()).toContain("does not allow");
        expect(await refusal(page).isVisible()).toBe(true);
        await sleep(500);
        expect((await recorded(page)).filter((r) => r.name === "loaded")).toEqual([]); // a refusal is not a load
      });

      test("wikipedia.org: the page shows, and the handler receives loaded", async () => {
        const page = await j.open();
        await show(page, WIKIPEDIA);
        expect(await waitRecorded(page, "loaded", 1, 30_000)).toEqual({ src: WIKIPEDIA });
        const inner = page.frames().find((f) => f !== page.mainFrame())!;
        expect(inner.url()).toBe(WIKIPEDIA);
        expect(await inner.locator("#firstHeading").textContent()).toContain("Attention Is All You Need");
        expect(await page.locator("iframe").isVisible()).toBe(true);
        expect(await refusal(page).count()).toBe(0);
        expect((await recorded(page)).filter((r) => r.name === "refused")).toEqual([]);
      });

      test("a site of our own: refused by either header, allowed without", async () => {
        const page = await j.open();
        await show(page, site.url("deny"));
        expect(await waitRecorded(page, "refused")).toEqual({ src: site.url("deny") });
        await refusal(page).waitFor();
        await show(page, site.url("csp"));
        expect(await waitRecorded(page, "refused", 2)).toEqual({ src: site.url("csp") });
        await show(page, site.url("ok"));
        expect(await waitRecorded(page, "loaded")).toEqual({ src: site.url("ok") });
        await page.frameLocator("iframe").locator("#where").waitFor();
        expect(await refusal(page).count()).toBe(0);
      });
    });
  } else {
    test("browser-only mode: a page that can be embedded shows and sends loaded", async () => {
      const page = await j.open();
      await show(page, site.url("ok"));
      expect(await waitRecorded(page, "loaded")).toEqual({ src: site.url("ok") });
      await page.frameLocator("iframe").locator("#where").waitFor();
    });
  }
});
