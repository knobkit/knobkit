import { expect, test } from "vitest";
import { journey, trigger, waitRecorded } from "../harness/index.js";

// KNOBKIT.md task 15: the gallery reports clicks
journey("t15", (j) => {
  test("clicking the second thumbnail gives the handler its index and caption", async () => {
    const page = await j.open();
    await page.locator(".pu-gallery-cell").nth(1).locator("img").click();
    expect(await waitRecorded(page, "clicked")).toEqual({ index: 1, caption: "second frame" });
  });

  test("the clicked thumbnail is shown as selected", async () => {
    const page = await j.open();
    const cells = page.locator(".pu-gallery-cell");
    const look = (i: number) =>
      cells.nth(i).locator("img").evaluate((el) => {
        const s = getComputedStyle(el);
        return `${s.outlineStyle} ${s.outlineWidth} ${s.borderTopColor}`;
      });
    const plain = await look(1);
    expect(await cells.nth(1).getAttribute("aria-pressed")).toBe("false");

    await cells.nth(1).locator("img").click();
    await expect.poll(() => cells.nth(1).getAttribute("aria-pressed")).toBe("true");
    // it looks different from before, and from the ones not clicked
    expect(await look(1)).not.toBe(plain);
    expect(await look(1)).toMatch(/^solid 2px/);
    expect(await look(0)).toBe(plain);
    expect(await cells.nth(0).getAttribute("aria-pressed")).toBe("false");

    // one at a time, and a handler can read which
    await cells.nth(2).locator("img").click();
    await expect.poll(() => cells.nth(2).getAttribute("aria-pressed")).toBe("true");
    expect(await cells.nth(1).getAttribute("aria-pressed")).toBe("false");
    expect(await look(1)).toBe(plain);
    await trigger(page, "which");
    expect(await waitRecorded(page, "selected")).toBe(2);
  });
});
