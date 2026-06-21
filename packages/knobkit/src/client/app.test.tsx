// @vitest-environment jsdom
import { test, expect } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { knobkit } from "../lib/knobkit.js";
import { declare } from "../lib/declare.js";
import { mic, log, chat, text, button, output, row, col } from "../lib/widgets/index.js";
import { App } from "./app.js";
import { createStore } from "./runtime.js";

test("App renders a live-like app (mic + log + chat) and reacts to edits", async () => {
  const audio = mic();
  const transcript = log();
  const convo = chat();
  const app = knobkit({ title: "Live", widgets: [audio, transcript, convo] });
  const decl = declare(app.config, app.serverEvents());
  const store = createStore(decl, () => {});

  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root")!);

  await act(async () => {
    root.render(<App decl={decl} store={store} />);
  });
  expect(document.body.textContent).toContain("Live");
  expect(document.querySelectorAll("button").length).toBeGreaterThan(0); // mic control
  expect(document.querySelector("input")).not.toBeNull(); // chat composer

  await act(async () => {
    store.applyEdit(app.keyFor(transcript), "append", ["lines"], "hello");
    store.applyEdit(app.keyFor(transcript), "append", ["lines"], "world");
  });
  expect(document.querySelector(".pu-log")!.textContent).toMatch(/hello.*world/);
});

test("nested layout renders: a row inside a col, children placed via slots", async () => {
  const field = text();
  const go = button({ label: "Go" });
  const result = output();
  const app = knobkit({ widgets: col(row(field, go), result) });
  const decl = declare(app.config, app.serverEvents());
  const store = createStore(decl, () => {});

  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(<App decl={decl} store={store} />);
  });

  const rowEl = document.querySelector(".pu-layout-row");
  expect(rowEl).not.toBeNull();
  expect(rowEl!.querySelector("input")).not.toBeNull();
  expect(rowEl!.querySelector("button")!.textContent).toContain("Go");
  expect(document.querySelector(".pu-layout-col")).not.toBeNull();
  expect(rowEl!.querySelector(".pu-output")).toBeNull();
});

test("mic({ control: false }) renders headless — no built-in button", async () => {
  const audio = mic({ control: false });
  const app = knobkit({ widgets: [audio] });
  const decl = declare(app.config, app.serverEvents());
  const store = createStore(decl, () => {});

  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(<App decl={decl} store={store} />);
  });
  expect(document.querySelectorAll("button").length).toBe(0);
});
