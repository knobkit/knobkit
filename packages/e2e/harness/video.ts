import type { Locator, Page } from "playwright";
import type { Engine } from "./index.js";

export interface Player {
  el: Locator;
  ready(): Promise<void>;
  /** the player's own clock and state, read from the element */
  now(): Promise<{ time: number; paused: boolean; duration: number }>;
  /** press the player the way a user does: a click on the picture plays or pauses it */
  toggle(): Promise<void>;
  /** drag the browser's own timeline control to a fraction of the clip */
  drag(fraction: number): Promise<void>;
}

export function player(page: Page, engine: Engine): Player {
  const el = page.locator("video").first();
  const now = (): Promise<{ time: number; paused: boolean; duration: number }> =>
    el.evaluate((v) => {
      const e = v as HTMLVideoElement;
      return { time: e.currentTime, paused: e.paused, duration: e.duration };
    });
  // where each engine draws its timeline inside the element (measured from screenshots; the
  // controls live in a closed shadow tree, so they cannot be found by selector)
  const track = async (): Promise<{ left: number; right: number; y: number }> => {
    const b = (await el.boundingBox())!;
    return engine === "chromium"
      ? { left: b.x + 16, right: b.x + b.width - 16, y: b.y + b.height - 23 }
      : { left: b.x + 145, right: b.x + b.width - 156, y: b.y + b.height - 29 };
  };
  return {
    el,
    now,
    async ready() {
      await el.waitFor();
      await page.waitForFunction(() => {
        const v = document.querySelector("video")!;
        return v.readyState >= 3 && v.duration > 0;
      });
    },
    async toggle() {
      const b = (await el.boundingBox())!;
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 3);
    },
    async drag(fraction) {
      const t = await track();
      const { time, duration } = await now();
      const from = Math.max(t.left + 4, t.left + (time / duration) * (t.right - t.left)); // on the thumb, not the track's edge
      const to = t.left + fraction * (t.right - t.left);
      await page.mouse.move(from, t.y - 40); // wake the controls, which hide while idle
      await page.mouse.move(from, t.y);
      await page.waitForTimeout(200);
      await page.mouse.down();
      await page.mouse.move(to, t.y, { steps: 12 });
      await page.mouse.up();
    },
  };
}
