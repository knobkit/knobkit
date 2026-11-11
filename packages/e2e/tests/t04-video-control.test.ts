import { expect, test } from "vitest";
import { journey, recorded, sleep, trigger, waitRecorded } from "../harness/index.js";
import { player } from "../harness/video.js";

// KNOBKIT.md task 4: a handler can read and move the video player
journey("t04", (j) => {
  test("a handler asks for the position and gets the player's own, within 0.1 s", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    await p.el.evaluate((v) => ((v as HTMLVideoElement).currentTime = 3.4));
    await sleep(400);
    await trigger(page, "ask");
    expect(Math.abs((await waitRecorded(page, "position")) - (await p.now()).time)).toBeLessThanOrEqual(0.1);

    // and while it runs: the answer lies between the player's clock just before and just after
    await p.toggle();
    await sleep(1000);
    const before = (await p.now()).time;
    await trigger(page, "ask");
    const got = await waitRecorded(page, "position", 2);
    const after = (await p.now()).time;
    expect(got).toBeGreaterThanOrEqual(before - 0.1);
    expect(got).toBeLessThanOrEqual(after + 0.1);
  });

  test("a handler moves the player to 6 s without the file being requested again", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    const src = await p.el.evaluate((v) => (v as HTMLVideoElement).src);
    // let the clip finish loading, so that what is counted below is caused by the move
    await page.waitForFunction(() => {
      const v = document.querySelector("video")!;
      return v.buffered.length > 0 && v.buffered.end(v.buffered.length - 1) >= v.duration - 0.1;
    });
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await trigger(page, "seek-6");
    await expect.poll(async () => Math.abs((await p.now()).time - 6)).toBeLessThanOrEqual(0.1);
    await sleep(500);
    expect(await p.el.evaluate((v) => (v as HTMLVideoElement).src)).toBe(src); // same address: not loaded again
    expect(requests.filter((u) => u === src || u.includes("clip-10s"))).toEqual([]);
    expect((await recorded(page)).filter((r) => r.name === "seeked")).toEqual([]);
  });

  test("a handler plays from 2 s to 5.5 s", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    await trigger(page, "range");
    // it starts at 2 s…
    await expect.poll(async () => (await p.now()).paused).toBe(false);
    const started = (await p.now()).time;
    expect(started).toBeGreaterThanOrEqual(2);
    expect(started).toBeLessThan(3);
    // …and stops at 5.5 s
    await expect.poll(async () => (await p.now()).paused, { timeout: 8000 }).toBe(true);
    expect(Math.abs((await p.now()).time - 5.5)).toBeLessThanOrEqual(0.25);
    await sleep(500);
    expect(Math.abs((await p.now()).time - 5.5)).toBeLessThanOrEqual(0.25);
  });

  test("a handler pauses the player, then plays it", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    await p.toggle(); // the user starts it
    await waitRecorded(page, "played");
    await trigger(page, "pause");
    await expect.poll(async () => (await p.now()).paused).toBe(true);
    const at = (await p.now()).time;
    await sleep(400);
    expect((await p.now()).time).toBe(at);
    await trigger(page, "play");
    await expect.poll(async () => (await p.now()).paused).toBe(false);
    await expect.poll(async () => (await p.now()).time).toBeGreaterThan(at + 0.3);
  });
});
