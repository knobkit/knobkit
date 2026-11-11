import { expect, test } from "vitest";
import { journey, waitRecorded } from "../harness/index.js";

const FULL = "en.wikipedia.org/wiki/Attention_Is_All_You_Need";

// KNOBKIT.md task 20: sidebar labels can be read in full
journey("t20", (j) => {
  test("hovering over a shortened sidebar label shows the full label", async () => {
    const page = await j.open();
    const label = page.locator(".pu-sidebar-label", { hasText: "en.wikipedia.org" });
    // it is shortened: the text does not fit its box
    expect(await label.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await label.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");
    expect(await label.getAttribute("title")).toBeNull();

    await label.hover();
    await expect.poll(() => label.getAttribute("title")).toBe(FULL);
    // what is under the pointer carries it
    const box = (await label.boundingBox())!;
    expect(
      await page.evaluate(([x, y]) => (document.elementFromPoint(x!, y!) as HTMLElement).closest("[title]")?.getAttribute("title"), [box.x + box.width / 2, box.y + box.height / 2]),
    ).toBe(FULL);

    // a label that fits gets none
    const short = page.locator(".pu-sidebar-label", { hasText: "Notes" });
    await short.hover();
    await page.waitForTimeout(200);
    expect(await short.getAttribute("title")).toBeNull();

    // the item still works
    await label.click();
    expect(await waitRecorded(page, "selected")).toEqual({ id: "wiki" });
  });
});
