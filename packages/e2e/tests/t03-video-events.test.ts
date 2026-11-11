import { expect, test } from "vitest";
import { journey, recorded, sleep, waitRecorded } from "../harness/index.js";
import { player } from "../harness/video.js";

// KNOBKIT.md task 3: the video player reports what the user does
journey("t03", (j) => {
  test("pausing sends a pause event with the player's position, within 0.1 s", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    await p.toggle();
    await sleep(1200);
    await p.toggle();
    const got = await waitRecorded(page, "paused");
    const own = await p.now();
    expect(own.paused).toBe(true);
    expect(own.time).toBeGreaterThan(0.5);
    expect(Math.abs(got.position - own.time)).toBeLessThanOrEqual(0.1);
  });

  test("pressing play sends a play event with the position", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    const before = await p.now();
    await p.toggle();
    const got = await waitRecorded(page, "played");
    expect(Math.abs(got.position - before.time)).toBeLessThanOrEqual(0.1);
    expect((await p.now()).paused).toBe(false);
  });

  test("dragging to another time sends a seek event with the new position", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    // Safari shows its timeline only once the clip has been started
    await p.toggle();
    await sleep(400);
    await p.toggle();
    await waitRecorded(page, "paused");
    await p.drag(0.6);
    const own = await p.now();
    expect(own.time).toBeGreaterThan(4); // the drag did move the player, to about 6 s
    await expect
      .poll(async () => {
        const seeks = (await recorded(page)).filter((r) => r.name === "seeked");
        return seeks.length ? Math.abs(seeks[seeks.length - 1]!.data.position - own.time) : 99;
      })
      .toBeLessThanOrEqual(0.1);
  });

  test("while playing, the position arrives at least once a second", async () => {
    const page = await j.open();
    const p = player(page, j.engine);
    await p.ready();
    await p.toggle();
    await sleep(4200);
    await p.toggle();
    await waitRecorded(page, "paused");
    const ticks = (await recorded(page)).filter((r) => r.name === "progress").map((r) => r.data as { position: number; at: number });
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!.at - ticks[i - 1]!.at).toBeLessThanOrEqual(1000);
      expect(ticks[i]!.position).toBeGreaterThan(ticks[i - 1]!.position);
    }
  });
});
