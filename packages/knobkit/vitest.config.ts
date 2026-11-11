import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { viewRefTransform } from "./src/cli/view-transform.js";

const here = dirname(fileURLToPath(import.meta.url));
const core = resolve(here, "../core/src");

// Views are lazy chunks, so the libraries they pull are found only as each one first renders; a
// re-bundle at that point hands the views a second React. Declared up front, as `knobkit dev` does
// (src/cli/view-deps.ts) — here by their own names, since this package is the root.
const pkg = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8")) as { dependencies: Record<string, string> };
const VIEW_DEPS = Object.keys(pkg.dependencies).filter((d) => !["react", "react-dom", "@knobkit/core", "tsx", "vite"].includes(d));
const REACT_DEPS = ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"];

// NodeNext sources import "./x.js" for "./x.ts"; vite needs the mapping spelled out.
const tsSource: Plugin = {
  name: "ts-source",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
    const base = resolve(dirname(importer), source);
    for (const cand of [base.replace(/\.js$/, ".tsx"), base.replace(/\.js$/, ".ts")]) {
      if (existsSync(cand)) return cand;
    }
    return null;
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [tsSource],
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        // Layout is only measurable where there is a layout engine: these run in a real browser,
        // against the sources of both packages, the way `knobkit dev` serves a mount app.
        plugins: [viewRefTransform(), tsSource],
        optimizeDeps: { include: [...REACT_DEPS, ...VIEW_DEPS] },
        resolve: {
          dedupe: ["react", "react-dom"],
          alias: [
            { find: /^@knobkit\/core\/client$/, replacement: resolve(core, "client/index.ts") },
            { find: /^@knobkit\/core\/server$/, replacement: resolve(core, "server/stub.ts") },
            { find: /^@knobkit\/core$/, replacement: resolve(core, "index.ts") },
          ],
        },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            viewport: { width: 1200, height: 760 },
            screenshotFailures: false,
          },
        },
      },
    ],
  },
});
