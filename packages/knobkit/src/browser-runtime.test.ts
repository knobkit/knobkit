// @vitest-environment jsdom
import { test, expect } from "vitest";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/knobkit.browser.js");

test.skipIf(!existsSync(bundle))("the built browser runtime mounts an app with no bundler", async () => {
  const knobkit = (await import(/* @vite-ignore */ bundle)) as typeof import("./index.js");

  const box = knobkit.text();
  const out = knobkit.output();
  const app = knobkit.knobkit({ widgets: [box, out] });
  app.on(box.changed, (t) => out.set(t));

  document.body.innerHTML = '<div id="root"></div>';
  app.mount("#root");

  for (let i = 0; i < 40 && !document.querySelector("input, textarea"); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  expect(document.querySelector("input, textarea")).not.toBeNull();
});
