import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, sleep, trigger } from "../harness/index.js";
import { codeEditor } from "../harness/editor.js";
import { player } from "../harness/video.js";

const openTab = async (page: Page, name: string): Promise<void> => {
  await page.getByRole("tab", { name }).click();
  await expect.poll(() => page.getByRole("tab", { name }).getAttribute("aria-selected")).toBe("true");
};
/** open another tab, look at it, and come back */
const awayAndBack = async (page: Page, name: string): Promise<void> => {
  await openTab(page, "Other");
  await expect.poll(() => page.locator(".pu-output", { hasText: "another tab" }).isVisible()).toBe(true);
  await sleep(400);
  await openTab(page, name);
  await sleep(300);
};

// KNOBKIT.md task 12: a tab that is not open keeps its state
journey("t12", (j) => {
  test("a video paused at 4 s is still paused at 4 s after another tab was open", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    await trigger(page, "seek-4");
    await expect.poll(async () => Math.abs((await p.now()).time - 4)).toBeLessThanOrEqual(0.1);
    await awayAndBack(page, "Video");
    expect(await p.el.isVisible()).toBe(true);
    const now = await p.now();
    expect(Math.abs(now.time - 4)).toBeLessThanOrEqual(0.1);
    expect(now.paused).toBe(true);
  });

  test("an embedded page has not loaded again", async () => {
    const page = await j.open();
    await openTab(page, "Page");
    await page.locator("iframe").waitFor();
    const child = (): import("playwright").Frame => page.frames().find((f) => f !== page.mainFrame())!;
    await expect.poll(() => page.frames().length).toBe(2);
    await child().waitForLoadState("load");
    // a mark on the page's own document: a second load would make a new document without it
    await child().evaluate(() => ((window as any).__mark = "first load"));
    let navigations = 0;
    page.on("framenavigated", (f) => {
      if (f !== page.mainFrame()) navigations++;
    });
    await awayAndBack(page, "Page");
    expect(await page.locator("iframe").isVisible()).toBe(true);
    expect(navigations).toBe(0);
    expect(await child().evaluate(() => (window as any).__mark)).toBe("first load");
  });

  test("a code editor scrolled to 1200 px with the cursor on line 80 comes back the same", async () => {
    const page = await j.open();
    await openTab(page, "Code");
    const t = codeEditor(page);
    await t.focusable.waitFor();
    await t.place(80, 1);
    const scroller = page.locator(".pu-code .cm-scroller");
    const box = (await scroller.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1200 - (await t.scrollTop()));
    await expect.poll(() => t.scrollTop()).toBe(1200);
    expect((await t.cursor()).line).toBe(80);
    await awayAndBack(page, "Code");
    expect(await scroller.isVisible()).toBe(true);
    expect(await t.scrollTop()).toBe(1200);
    expect((await t.cursor()).line).toBe(80);
  });

  test("a terminal's output is there after another tab was open", async () => {
    const page = await j.open();
    await openTab(page, "Terminal");
    const rows = page.locator(".pu-terminal .xterm-rows");
    await expect.poll(async () => (await rows.textContent()) ?? "").toContain("second line of output");
    const before = await rows.textContent();
    await awayAndBack(page, "Terminal");
    expect(await rows.isVisible()).toBe(true);
    expect(await rows.textContent()).toBe(before);
    expect(before).toContain("hello from the terminal");
  });
});
