import { execFileSync } from "node:child_process";
import { connect } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { chromium, webkit } from "playwright";
import type { Browser } from "playwright";
import { startApp } from "../harness/server.js";
import type { Running } from "../harness/server.js";

/** every process started, directly or not, by `pid` */
function descendants(pid: number): number[] {
  const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/).map(Number) as [number, number]);
  const found: number[] = [];
  const walk = (p: number): void => {
    for (const [child, parent] of rows) {
      if (parent === p) {
        found.push(child);
        walk(child);
      }
    }
  };
  walk(pid);
  return found;
}

const running = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** nothing answers on the port, on either loopback address */
const portFree = async (port: number): Promise<boolean> => {
  const refused = (host: string): Promise<boolean> =>
    new Promise((res) => {
      const s = connect({ port, host });
      s.once("connect", () => {
        s.destroy();
        res(false);
      });
      s.once("error", () => res(true));
    });
  return (await refused("127.0.0.1")) && (await refused("::1"));
};

const ENGINES = (process.env["E2E_BROWSERS"]?.split(",") ?? ["chromium", "webkit"]).filter((e) => e === "chromium" || e === "webkit");
const MODES = (process.env["E2E_MODES"]?.split(",") ?? ["mount", "serve"]).filter((m) => m === "mount" || m === "serve");

// KNOBKIT.md task 28: `knobkit dev` stops its child processes
describe.each(MODES)("%s", (mode) => {
  describe.each(ENGINES)("%s", (engine) => {
    let dev: Running | undefined;
    let browser: Browser | undefined;
    afterEach(async () => {
      await browser?.close();
      await dev?.stop(); // whatever is left of it, so a failure does not leak into other tests
    });

    test("a terminate signal ends everything it started within 2 s and frees the port", async () => {
      const port = (mode === "serve" ? 4228 : 4268) + (engine === "webkit" ? 1 : 0);
      dev = await startApp(mode === "serve" ? "t27" : "mount", { port });
      // a page is open on it, as during development: an open connection must not hold it up
      browser = await (engine === "chromium" ? chromium : webkit).launch({ headless: process.env["E2E_HEADED"] !== "1" });
      const page = await browser.newPage();
      await page.goto(mode === "serve" ? dev.url : `${dev.url}?app=t27`);
      await page.locator("a.pu-file").waitFor();

      const started = descendants(dev.proc.pid!);
      if (mode === "serve") expect(started.length).toBeGreaterThanOrEqual(2); // the watcher, and the app under it
      expect(await portFree(port)).toBe(false);

      const at = Date.now();
      process.kill(dev.proc.pid!, "SIGTERM"); // to `knobkit dev` alone, not to its group
      let left: number[] = [];
      let free = false;
      while (Date.now() - at < 2000) {
        left = [dev.proc.pid!, ...started].filter(running);
        free = await portFree(port);
        if (left.length === 0 && free) break;
        await new Promise((r) => setTimeout(r, 25));
      }
      const took = Date.now() - at;
      expect(left, `still running after ${took} ms`).toEqual([]);
      expect(free, `port ${port} still taken after ${took} ms`).toBe(true);
      expect(took).toBeLessThan(2000);
    });
  });
});
