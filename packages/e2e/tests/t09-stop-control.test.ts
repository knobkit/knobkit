import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, waitRecorded } from "../harness/index.js";

const send = async (page: Page, text: string): Promise<void> => {
  await page.locator(".pu-composer input").click();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
};

// KNOBKIT.md task 9: the conversation has a stop control
journey("t09", (j) => {
  test("the stop control shows while a handler has marked a run as started, and goes when it ends", async () => {
    const page = await j.open();
    const stop = page.getByRole("button", { name: "Stop" });
    expect(await stop.count()).toBe(0);
    await send(page, "short");
    await stop.waitFor();
    expect(await stop.isVisible()).toBe(true);
    await waitRecorded(page, "ended");
    await expect.poll(() => stop.count()).toBe(0);
  });

  test("clicking stop during a run reaches its handler while the message's handler is still running", async () => {
    const page = await j.open();
    await send(page, "long run");
    await page.getByRole("button", { name: "Stop" }).click();
    await waitRecorded(page, "stopped");
    // at that moment the run has started and not ended
    expect((await recorded(page)).map((r) => r.name)).toEqual(["started", "stopped"]);
    await waitRecorded(page, "ended");
    expect((await recorded(page)).map((r) => r.name)).toEqual(["started", "stopped", "ended"]);
  });

  test("the input accepts typing while the stop control is shown", async () => {
    const page = await j.open();
    await send(page, "long run");
    await page.getByRole("button", { name: "Stop" }).waitFor();
    const input = page.locator(".pu-composer input");
    await input.click();
    await page.keyboard.type("typed during the run");
    expect(await input.inputValue()).toBe("typed during the run");
    expect(await input.isEnabled()).toBe(true);
    expect(await page.getByRole("button", { name: "Stop" }).isVisible()).toBe(true);
    expect((await recorded(page)).map((r) => r.name)).toEqual(["started"]); // still running
  });
});
