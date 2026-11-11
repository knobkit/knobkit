import { afterAll, afterEach, beforeAll, describe, inject } from "vitest";
import { chromium, webkit } from "playwright";
import type { Browser, BrowserContext, BrowserContextOptions, Page } from "playwright";
import { startApp } from "./server.js";
import type { Running } from "./server.js";

export type Mode = "mount" | "serve";
export type Engine = "chromium" | "webkit";

const only = <T extends string>(env: string, all: T[]): T[] => {
  const want = process.env[env]?.split(",").filter(Boolean);
  return want ? all.filter((x) => want.includes(x)) : all;
};
const MODES = only<Mode>("E2E_MODES", ["mount", "serve"]);
const ENGINES = only<Engine>("E2E_BROWSERS", ["chromium", "webkit"]);
const HEADED = process.env["E2E_HEADED"] === "1";

export interface Journey {
  mode: Mode;
  engine: Engine;
  /** the app's address in this mode */
  url(): string;
  /** a fresh window on the app, rendered */
  open(opts?: BrowserContextOptions): Promise<Page>;
  context(): BrowserContext;
}

/** the server-mode port of a fixture: t07 → 4207, t07b → 4247 */
function portOf(app: string): number {
  const m = /^t(\d+)([a-z]?)/.exec(app);
  if (!m) throw new Error(`fixture name "${app}" must start with t<number>`);
  return 4200 + Number(m[1]) + (m[2] ? (m[2].charCodeAt(0) - 96) * 40 : 0);
}

/**
 * Define checks once; they run in each browser engine, browser-only and from a server. Narrow with
 * `modes` / `engines` only where the check itself names one.
 */
export function journey(
  app: string,
  define: (j: Journey) => void,
  opts: { modes?: Mode[]; engines?: Engine[]; env?: Record<string, string> } = {},
): void {
  for (const mode of (opts.modes ?? ["mount", "serve"]).filter((m) => MODES.includes(m))) {
    describe(mode, () => {
      let server: Running | undefined;
      let base = "";
      beforeAll(async () => {
        if (mode === "mount") base = `${inject("mountUrl")}?app=${app}`;
        else {
          server = await startApp(app, { port: portOf(app), env: opts.env });
          base = server.url;
        }
      });
      afterAll(async () => {
        await server?.stop();
      });

      for (const engine of (opts.engines ?? ["chromium", "webkit"]).filter((e) => ENGINES.includes(e))) {
        describe(engine, () => {
          let browser: Browser;
          let ctx: BrowserContext | undefined;
          beforeAll(async () => {
            browser = await (engine === "chromium" ? chromium : webkit).launch({ headless: !HEADED });
          });
          afterAll(async () => {
            await browser?.close();
          });
          afterEach(async () => {
            await ctx?.close();
            ctx = undefined;
          });

          define({
            mode,
            engine,
            url: () => base,
            context: () => ctx!,
            async open(o) {
              await ctx?.close();
              ctx = await browser.newContext({ viewport: { width: 1200, height: 760 }, ...o });
              const page = await ctx.newPage();
              await page.goto(base);
              await page.locator("#root .pu-field").first().waitFor();
              return page;
            },
          });
        });
      }
    });
  }
}

/** What the fixture's handlers recorded, in order (see apps/_rec.ts). */
export async function recorded(page: Page): Promise<{ name: string; data: any }[]> {
  const text = await page.locator("[data-rec]").first().textContent();
  return JSON.parse(text || "[]") ?? [];
}

/** Wait until the handlers have recorded an entry named `name` (the `n`th, from 1); returns its data. */
export async function waitRecorded(page: Page, name: string, n = 1, timeout = 10_000): Promise<any> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const hits = (await recorded(page)).filter((r) => r.name === name);
    if (hits.length >= n) return hits[n - 1]!.data;
    if (Date.now() > deadline) throw new Error(`handler never recorded "${name}" #${n}; got ${JSON.stringify(await recorded(page))}`);
    await page.waitForTimeout(50);
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Run a fixture's handler by its button, without moving the keyboard focus off what is under test. */
export async function trigger(page: Page, label: string): Promise<void> {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === l);
    if (!b) throw new Error(`no button "${l}"`);
    b.click();
  }, label);
}

/** The text a handler reads from the fixture's widget (its "read" button records it). */
export async function readText(page: Page): Promise<string> {
  const before = (await recorded(page)).filter((r) => r.name === "text").length;
  await trigger(page, "read");
  return (await waitRecorded(page, "text", before + 1)) as string;
}
