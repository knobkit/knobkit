import { expect, test } from "vitest";
import type { Page } from "playwright";
import { journey, recorded, sleep, waitRecorded } from "../harness/index.js";

const send = async (page: Page, text: string): Promise<void> => {
  await page.locator(".pu-composer input").click();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
};

/** the messages on screen marked as waiting: shown, with the mark */
const waiting = (page: Page): Promise<string[]> =>
  page.locator(".pu-msg-waiting").evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el).visibility === "visible" && el.getBoundingClientRect().height > 0 && /waiting/.test(el.textContent ?? ""))
      .map((el) => el.firstChild!.textContent ?? ""),
  );
const shown = (page: Page, text: string): Promise<number> =>
  page.locator(".pu-msg.pu-user").evaluateAll((els, t) => els.filter((el) => (el.firstChild?.textContent ?? el.textContent) === t || el.textContent === `user: ${t}`).length, text);

// KNOBKIT.md task 8: a message sent during a run is visibly received
journey("t08", (j) => {
  test("a message sent 0.5 s into a 3 s handler is on screen, marked as waiting, within 0.3 s", async () => {
    const page = await j.open();
    await send(page, "first message");
    await waitRecorded(page, "started");
    await sleep(500);
    await page.locator(".pu-composer input").click();
    await page.keyboard.type("second message");
    const sentAt = Date.now();
    await page.keyboard.press("Enter");
    await expect.poll(() => waiting(page), { interval: 20, timeout: 2000 }).toEqual(["second message"]);
    expect(Date.now() - sentAt).toBeLessThanOrEqual(300);
    // its handler has not started: the first is still running
    expect((await recorded(page)).map((r) => `${r.name}:${r.data}`)).toEqual(["started:first message"]);
    expect(await page.locator(".pu-composer input").inputValue()).toBe("");
  });

  test("when its handler starts, the waiting mark is gone and the message appears once", async () => {
    const page = await j.open();
    await send(page, "first message");
    await waitRecorded(page, "started");
    await sleep(500);
    await send(page, "second message");
    await expect.poll(() => waiting(page)).toEqual(["second message"]);
    expect(await shown(page, "second message")).toBe(1);

    await waitRecorded(page, "started", 2, 8000);
    await expect.poll(() => waiting(page)).toEqual([]);
    expect(await page.locator(".pu-msg-waiting").count()).toBe(0);
    expect(await shown(page, "second message")).toBe(1);
    expect((await recorded(page)).map((r) => `${r.name}:${r.data}`)).toEqual([
      "started:first message",
      "ended:first message",
      "started:second message",
    ]);
  });

  test("a message that does not have to wait is never shown as waiting", async () => {
    const page = await j.open();
    // watch every frame for a waiting mark while two quick messages go through
    await page.evaluate(() => {
      (window as any).__sawWaiting = false;
      const look = (): void => {
        for (const el of document.querySelectorAll(".pu-msg-waiting")) {
          if (getComputedStyle(el).visibility === "visible") (window as any).__sawWaiting = true;
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await send(page, "quick one");
    await waitRecorded(page, "ended");
    await send(page, "quick two");
    await waitRecorded(page, "ended", 2);
    await sleep(300);
    expect(await page.evaluate(() => (window as any).__sawWaiting)).toBe(false);
    expect(await shown(page, "quick one")).toBe(1);
    expect(await shown(page, "quick two")).toBe(1);
  });
});
