// @vitest-environment jsdom
import { test, expect } from "vitest";
import { act } from "react";
import { knobkit } from "../lib/knobkit.js";
import { text, json, button, embed } from "../lib/widgets/index.js";
import { declare } from "../lib/declare.js";
import { mount } from "./mount.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function type(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function countWords(box: ReturnType<typeof text>, stats: ReturnType<typeof json>) {
  return knobkit({ widgets: [box, stats] }).on(box.changed, (t: string) =>
    stats.set({ words: t.trim() ? t.trim().split(/\s+/).length : 0 }),
  );
}

test("embed merges a sub-app's handlers and setups into the parent", () => {
  const box = text();
  const stats = json();
  const sub = countWords(box, stats);
  sub.setup(() => {});

  const parent = knobkit({ widgets: [button({ label: "x" }), embed(sub)] });

  expect(parent.handlers.has(box.changed.type)).toBe(true);
  expect(parent.serverEvents()).toContain(box.changed.type);
  expect(parent.setups.length).toBe(1);
  expect(() => parent.keyFor(box)).not.toThrow();

  const decl = declare(parent.config, parent.serverEvents());
  for (const w of decl.widgets) expect(w.props.__subapp).toBeUndefined();
  expect(decl.widgets.some((w) => w.type === "json")).toBe(true);
});

test("an embedded sub-app's handler fires through the parent store", async () => {
  const box = text();
  const stats = json();
  const parent = knobkit({ widgets: embed(countWords(box, stats)) });
  document.body.innerHTML = '<div id="root"></div>';

  await act(async () => {
    mount(parent, "#root");
  });
  const input = document.querySelector("input") as HTMLInputElement;
  expect(input).not.toBeNull();

  await act(async () => {
    type(input, "hello there world");
    await tick();
  });
  expect(document.querySelector("pre")!.textContent).toContain('"words": 3');
});
