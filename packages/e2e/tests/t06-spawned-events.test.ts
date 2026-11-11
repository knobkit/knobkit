import { expect, test } from "vitest";
import { journey, recorded, waitRecorded } from "../harness/index.js";

// KNOBKIT.md task 6: widgets created during a run send their events in server mode.
// The task names server mode; browser-only mode runs the same checks.
journey("t06", (j) => {
  test("a dropdown created during a handler delivers the option the user picks", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "make-one" }).click();
    await page.locator("select").selectOption("green");
    expect(await waitRecorded(page, "picked")).toBe("green");
  });

  test("the same for a conversation and a button", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "make-one" }).click();
    const input = page.getByPlaceholder("made during a run");
    await input.click();
    await page.keyboard.type("hello from the user");
    await page.keyboard.press("Enter");
    expect(await waitRecorded(page, "sent")).toBe("hello from the user");
    await page.getByRole("button", { name: "made", exact: true }).click();
    await waitRecorded(page, "clicked");
  });

  test("three widgets created in one handler each deliver to their own handler", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "make-three" }).click();
    const picks = page.locator("select");
    await expect.poll(() => picks.count()).toBe(3);
    await picks.nth(1).selectOption("b2");
    await picks.nth(2).selectOption("c1");
    await picks.nth(0).selectOption("a1");
    expect(await waitRecorded(page, "picked-b")).toBe("b2");
    expect(await waitRecorded(page, "picked-c")).toBe("c1");
    expect(await waitRecorded(page, "picked-a")).toBe("a1");
    expect((await recorded(page)).map((r) => r.name)).toEqual(["picked-b", "picked-c", "picked-a"]);
  });

  test("a handler registered before the widget is added still receives", async () => {
    const page = await j.open();
    await page.getByRole("button", { name: "make-early" }).click();
    await page.getByRole("button", { name: "made-early" }).click();
    await waitRecorded(page, "clicked-early");
  });

  test("another window's widgets do not answer this one", async () => {
    const page = await j.open();
    const other = await j.context().newPage();
    await other.goto(j.url());
    await other.getByRole("button", { name: "make-one" }).click();
    await other.locator("select").waitFor();
    await page.getByRole("button", { name: "make-one" }).click();
    await page.locator("select").selectOption("blue");
    expect(await waitRecorded(page, "picked")).toBe("blue");
    expect(await recorded(other)).toEqual([]);
    expect((await recorded(page)).length).toBe(1);
  });
});
