import { expect, test } from "vitest";
import type { Page } from "playwright";
import { readText, recorded, sleep, trigger, waitRecorded } from "./index.js";
import type { Journey } from "./index.js";
import type { TextTarget } from "./editor.js";

/**
 * The six checks of KNOBKIT.md task 1, written against a `TextTarget` so task 2 runs the same six
 * on the multi-line text box. The fixture supplies the buttons named here (see apps/t01.tsx).
 */
export function refreshChecks(j: Journey, target: (page: Page) => TextTarget): void {
  const changedCount = async (page: Page): Promise<number> => (await recorded(page)).filter((r) => r.name === "changed").length;

  test("lines added at the end leave the cursor at line 12, column 5, and typing goes there", async () => {
    const page = await j.open();
    const t = target(page);
    await t.place(12, 5);
    expect(await t.cursor()).toEqual({ line: 12, column: 5 });
    await trigger(page, "add-end");
    await expect.poll(async () => (await readText(page)).split("\n").length).toBe(23);
    expect(await t.cursor()).toEqual({ line: 12, column: 5 });
    await page.keyboard.type("X");
    const text = await readText(page);
    expect(text.split("\n")[11]).toBe("lineX 12 of the document");
  });

  test("lines added at line 2 move the cursor to line 15, column 5", async () => {
    const page = await j.open();
    const t = target(page);
    await t.place(12, 5);
    await trigger(page, "add-at-2");
    await expect.poll(async () => (await readText(page)).split("\n").length).toBe(23);
    expect(await t.cursor()).toEqual({ line: 15, column: 5 });
  });

  test("identical text leaves cursor, selection and scroll position unchanged", async () => {
    const page = await j.open();
    const t = target(page);
    await trigger(page, "long");
    await expect.poll(async () => (await readText(page)).split("\n").length).toBe(400);
    await t.place(30, 3);
    for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowRight");
    await t.scrollToLine(20);
    const before = { cursor: await t.cursor(), selection: await t.selection(), scroll: await t.scrollTop() };
    expect(before.selection.to - before.selection.from).toBe(6);
    expect(before.scroll).toBeGreaterThan(100);
    await trigger(page, "same");
    await readText(page); // the handler has run and its write has been applied
    await sleep(200);
    expect({ cursor: await t.cursor(), selection: await t.selection(), scroll: await t.scrollTop() }).toEqual(before);
  });

  test("a change at line 390 leaves a view scrolled to line 200 where it is", async () => {
    const page = await j.open();
    const t = target(page);
    await trigger(page, "long");
    await expect.poll(async () => (await readText(page)).split("\n").length).toBe(400);
    await t.focusable.click();
    await t.scrollToLine(200);
    const before = await t.scrollTop();
    expect(before).toBeGreaterThan(1000);
    await trigger(page, "change-390");
    await expect.poll(async () => (await readText(page)).split("\n")[389]).toBe("line 390 was changed by a handler");
    await sleep(200);
    expect(await t.scrollTop()).toBe(before);
  });

  test("a refresh sends no changed event", async () => {
    const page = await j.open();
    const t = target(page);
    await t.place(12, 5);
    await page.keyboard.type("a");
    await expect.poll(() => changedCount(page)).toBe(1); // the handler does hear the user
    for (const b of ["add-end", "add-at-2", "same", "change-390"]) await trigger(page, b);
    await readText(page);
    await sleep(300);
    expect(await changedCount(page)).toBe(1);
  });

  test("20 letters typed across a refresh stay together, in order, where they were typed", async () => {
    const page = await j.open();
    const t = target(page);
    await trigger(page, "auto");
    await t.place(10, 8);
    const letters = "abcdefghijklmnopqrst";
    for (const ch of letters) {
      await page.keyboard.type(ch);
      await sleep(150);
    }
    await expect.poll(() => changedCount(page)).toBe(20);
    const text = await readText(page);
    const l = text.split("\n");
    expect(text).toContain("## A section added by the handler"); // the refresh did happen mid-typing
    expect(l[9]).toBe(`line 10${letters} of the document`);
    await waitRecorded(page, "changed", 20);
  });
}
