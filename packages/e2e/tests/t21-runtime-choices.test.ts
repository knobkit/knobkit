import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, trigger, waitRecorded } from "../harness/index.js";

const options = (page: Page): Promise<string[]> =>
  page.locator("select.pu-input option:not([hidden])").evaluateAll((els) => els.map((el) => el.textContent ?? ""));
const labels = (page: Page, group: string): Promise<string[]> =>
  page.locator(`${group} label`).evaluateAll((els) => els.map((el) => (el.textContent ?? "").trim()));
const values = async (page: Page): Promise<any> => {
  const n = (await recorded(page)).filter((r) => r.name === "values").length;
  await trigger(page, "read");
  return waitRecorded(page, "values", n + 1);
};

// KNOBKIT.md task 21: choices can change during a run
journey("t21", (j) => {
  test("a handler sets a dropdown's options to three new ones; the user picks one", async () => {
    const page = await j.open();
    expect(await options(page)).toEqual(["a", "b", "c"]);
    await page.getByRole("button", { name: "new-choices" }).click();
    await expect.poll(() => options(page)).toEqual(["x", "Why", "z"]);
    await page.locator("select.pu-input").selectOption({ label: "Why" });
    expect(await waitRecorded(page, "pick")).toBe("y");
    expect((await values(page)).pick).toBe("y");
  });

  test("the same for the radio group and the checkbox group", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "new-choices" }).click();
    await expect.poll(() => labels(page, ".pu-radio")).toEqual(["x", "y", "z"]);
    await expect.poll(() => labels(page, ".pu-checkgroup")).toEqual(["x", "y", "z"]);

    await page.locator(".pu-radio label", { hasText: "z" }).click();
    expect(await waitRecorded(page, "one")).toBe("z");
    await page.locator(".pu-checkgroup label", { hasText: "x" }).click();
    expect(await waitRecorded(page, "many")).toEqual(["x"]);
    await page.locator(".pu-checkgroup label", { hasText: "z" }).click();
    expect(await waitRecorded(page, "many", 2)).toEqual(["x", "z"]);
    expect(await values(page)).toMatchObject({ one: "z", many: ["x", "z"] });
  });

  test("a handler sets a slider's range to 0–10; the user cannot go past 10", async () => {
    const page = await j.open();
    const input = page.locator('.pu-slider input[type="range"]');
    await page.getByRole("button", { name: "range-0-10" }).click();
    await expect.poll(() => input.getAttribute("max")).toBe("10");
    // 50 was outside the new range: it is at the end of it
    await expect.poll(() => input.inputValue()).toBe("10");

    // with the pointer: dragged from the middle to well past the right end
    const box = (await input.boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    for (const x of [0.6, 0.75, 0.9, 1].map((f) => box.x + box.width * f).concat(box.x + box.width + 150, box.x + box.width + 300)) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(60);
    }
    await page.mouse.up();
    await expect.poll(() => input.inputValue()).toBe("10");
    const moved = (await recorded(page)).filter((r) => r.name === "level").map((r) => r.data as number);
    expect(moved.length).toBeGreaterThan(0);
    expect(Math.max(...moved)).toBe(10);
    expect(Math.min(...moved)).toBeGreaterThanOrEqual(0);

    // with the keyboard: down three, then right far more times than there are steps
    await input.focus();
    // (at a person's pace: a held key repeats about every 30 ms)
    const press = async (key: string, times: number): Promise<void> => {
      for (let i = 0; i < times; i++) {
        await page.keyboard.press(key);
        await page.waitForTimeout(40);
      }
    };
    await press("ArrowLeft", 3);
    await expect.poll(() => input.inputValue()).toBe("7");
    await press("ArrowRight", 20);
    expect(await input.inputValue()).toBe("10");
    await page.keyboard.press("End");
    expect(await input.inputValue()).toBe("10");
    expect(await page.locator(".pu-slider-val").textContent()).toBe("10");
    expect((await values(page)).level).toBe(10);
    expect(Math.max(...(await recorded(page)).filter((r) => r.name === "level").map((r) => r.data as number))).toBe(10);
  });

  test("a selected value that is no longer among the options is cleared", async () => {
    const page = await j.open();
    expect(await values(page)).toMatchObject({ pick: "b", one: "b", many: ["a", "b"] });
    await page.getByRole("button", { name: "new-choices" }).click();
    await waitRecorded(page, "set");
    expect(await values(page)).toMatchObject({ pick: "", one: "", many: [] });
    // and on screen: nothing chosen
    expect(await page.locator("select.pu-input").evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.textContent ?? "")).toBe("");
    expect(await page.locator('.pu-radio input[type="radio"]:checked').count()).toBe(0);
    expect(await page.locator('.pu-checkgroup input[type="checkbox"]:checked').count()).toBe(0);
    // clearing is the handler's doing: no change event comes back for it
    expect((await recorded(page)).filter((r) => ["pick", "one", "many"].includes(r.name))).toEqual([]);
  });

  test("a selected value that is still among the options stays", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "overlapping-choices" }).click();
    await waitRecorded(page, "set");
    expect(await values(page)).toMatchObject({ pick: "b", one: "b", many: ["b"] });
    expect(await page.locator("select.pu-input").inputValue()).toBe("b");
    expect(await page.locator('.pu-radio input[type="radio"]:checked').count()).toBe(1);
  });
});
