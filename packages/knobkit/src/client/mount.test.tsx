// @vitest-environment jsdom
import { test, expect } from "vitest";
import { act } from "react";
import { knobkit } from "../lib/knobkit.js";
import { text, json } from "../lib/widgets/index.js";
import { mount } from "./mount.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function type(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

test("mount owns state and runs on(...) handlers locally", async () => {
  const box = text();
  const stats = json();
  const app = knobkit({ widgets: [box, stats] }).on(box.changed, (t: string) =>
    stats.set({ words: t.trim() ? t.trim().split(/\s+/).length : 0 }),
  );
  document.body.innerHTML = '<div id="root"></div>';

  await act(async () => {
    mount(app, "#root");
  });
  const input = document.querySelector("input") as HTMLInputElement;
  expect(input).not.toBeNull();

  await act(async () => {
    type(input, "hello there world");
    await tick();
  });
  expect(input.value).toBe("hello there world"); // local set drove the controlled input
  expect(document.querySelector("pre")!.textContent).toContain('"words": 3'); // local handler ran
});
