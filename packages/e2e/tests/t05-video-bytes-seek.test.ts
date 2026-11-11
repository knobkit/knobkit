import { expect, test } from "vitest";
import { journey, sleep } from "../harness/index.js";
import { player } from "../harness/video.js";

// KNOBKIT.md task 5: a video sent as bytes can be seeked in server mode.
// The task names Chromium in server mode; WebKit runs the same checks.
journey(
  "t05",
  (j) => {
    test("setting the position to 6 s leaves the player at 6 s", async () => {
      const page = await j.open();
      const p = player(page, j.engine);
      await p.ready();
      expect((await p.now()).duration).toBeCloseTo(10, 0);
      await p.el.evaluate((v) => ((v as HTMLVideoElement).currentTime = 6));
      await sleep(500);
      expect(Math.abs((await p.now()).time - 6)).toBeLessThanOrEqual(0.1);
    });

    test("the player reports the whole 10 s as seekable", async () => {
      const page = await j.open();
      const p = player(page, j.engine);
      await p.ready();
      const ranges = await p.el.evaluate((v) => {
        const s = (v as HTMLVideoElement).seekable;
        return Array.from({ length: s.length }, (_, i) => [s.start(i), s.end(i)]);
      });
      expect(ranges.length).toBe(1);
      expect(ranges[0]![0]).toBeLessThanOrEqual(0.05);
      expect(ranges[0]![1]).toBeGreaterThanOrEqual(9.9);
    });

    test("a byte-range request to the media address gets a 206 with the range in its headers", async () => {
      const page = await j.open();
      const p = player(page, j.engine);
      await p.ready();
      const src = await p.el.evaluate((v) => (v as HTMLVideoElement).src);
      expect(new URL(src).pathname).toMatch(/^\/__media\//);
      const whole = await fetch(src);
      const size = Number(whole.headers.get("content-length"));
      const all = new Uint8Array(await whole.arrayBuffer());
      expect(whole.status).toBe(200);
      expect(whole.headers.get("accept-ranges")).toBe("bytes");
      expect(all.byteLength).toBe(size);

      const part = await fetch(src, { headers: { range: "bytes=1000-1999" } });
      expect(part.status).toBe(206);
      expect(part.headers.get("content-range")).toBe(`bytes 1000-1999/${size}`);
      expect(part.headers.get("content-length")).toBe("1000");
      expect(new Uint8Array(await part.arrayBuffer())).toEqual(all.slice(1000, 2000));

      const tail = await fetch(src, { headers: { range: `bytes=${size - 10}-` } });
      expect(tail.status).toBe(206);
      expect(tail.headers.get("content-range")).toBe(`bytes ${size - 10}-${size - 1}/${size}`);

      const beyond = await fetch(src, { headers: { range: `bytes=${size}-` } });
      expect(beyond.status).toBe(416);
    });
  },
  { modes: ["serve"] },
);
