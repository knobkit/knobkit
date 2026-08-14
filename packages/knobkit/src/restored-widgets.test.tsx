// @vitest-environment jsdom
import { expect, test } from "vitest";
import { mountApp, register } from "@knobkit/core/client";
import {
  knobkit,
  slider,
  checkbox,
  checkboxGroup,
  radio,
  json,
  label,
  html,
  progress,
  file,
  gallery,
  video,
  annotatedImage,
  highlightedText,
} from "./index.js";

register("col", () => import("./widgets/layout/col.js"));
register("slider", () => import("./widgets/slider/view.js"));
register("checkbox", () => import("./widgets/checkbox/view.js"));
register("checkboxGroup", () => import("./widgets/checkbox-group/view.js"));
register("radio", () => import("./widgets/radio/view.js"));
register("json", () => import("./widgets/json/view.js"));
register("label", () => import("./widgets/label/view.js"));
register("html", () => import("./widgets/html/view.js"));
register("progress", () => import("./widgets/progress/view.js"));
register("file", () => import("./widgets/file/view.js"));
register("gallery", () => import("./widgets/gallery/view.js"));
register("video", () => import("./widgets/video/view.js"));
register("annotatedImage", () => import("./widgets/annotated-image/view.js"));
register("highlightedText", () => import("./widgets/highlighted-text/view.js"));

const until = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 80 && !cond(); i++) await new Promise((r) => setTimeout(r, 25));
  expect(cond()).toBe(true);
};

test("restored widgets render, apply ops, and dispatch input", async () => {
  const s = slider({ value: 30 });
  const cb = checkbox({ label: "On", value: true });
  const cg = checkboxGroup({ choices: ["a", "b"], value: ["a"] });
  const r = radio({ choices: ["x", "y"] });
  const j = json();
  const lb = label();
  const h = html({ value: "<b>hi</b>" });
  const p = progress({ label: "Working" });
  const f = file();
  const g = gallery();
  const v = video();
  const ai = annotatedImage();
  const ht = highlightedText();

  const toggles: boolean[] = [];
  const app = knobkit({
    widgets: [s, cb, cg, r, j, lb, h, p, f, g, v, ai, ht],
  });
  app.on(cb.changed, (on) => {
    toggles.push(on);
  });
  app.setup(() => {
    j.set({ ok: 1 });
    lb.set({ confidences: [{ label: "cat", score: 0.9 }, { label: "dog", score: 0.1 }] });
    p.set(0.5);
    f.set({ name: "report.txt", url: "https://example.com/r.txt" });
    g.add({ src: "https://example.com/a.png", caption: "A" });
    v.set("https://example.com/clip.mp4");
    ai.set("https://example.com/scene.png", [{ label: "cat", box: [0, 0, 10, 10] }]);
    ht.set([{ text: "hello " }, { text: "world", label: "PLACE" }]);
  });

  document.body.innerHTML = '<div id="root"></div>';
  mountApp(app, "#root");

  await until(() => document.querySelectorAll(".pu-slider, .pu-check, .pu-checkgroup, .pu-radio").length === 4);

  const range = document.querySelector<HTMLInputElement>(".pu-slider input[type=range]")!;
  expect(range.value).toBe("30");

  const box = document.querySelector<HTMLInputElement>(".pu-check input[type=checkbox]")!;
  expect(box.checked).toBe(true);

  expect(document.querySelectorAll(".pu-checkgroup input[type=checkbox]").length).toBe(2);
  expect(document.querySelector<HTMLInputElement>(".pu-checkgroup input")!.checked).toBe(true);

  const radios = document.querySelectorAll<HTMLInputElement>(".pu-radio input[type=radio]");
  expect(radios.length).toBe(2);
  expect(radios[0].checked).toBe(true);

  await until(() => (document.querySelector(".pu-json")?.textContent ?? "").includes("ok"));
  await until(() => (document.querySelector(".pu-label")?.textContent ?? "").includes("cat"));
  expect(document.querySelector(".pu-html")!.innerHTML).toContain("<b>hi</b>");
  await until(() => (document.querySelector(".pu-progress")?.textContent ?? "").includes("Working"));
  await until(() => (document.querySelector(".pu-file")?.textContent ?? "").includes("report.txt"));
  expect(document.querySelector<HTMLAnchorElement>("a.pu-file")!.href).toBe("https://example.com/r.txt");
  await until(() => document.querySelector<HTMLImageElement>(".pu-gallery img")?.src === "https://example.com/a.png");
  expect(document.querySelector(".pu-gallery")!.textContent).toContain("A");
  await until(() => document.querySelector("video.pu-video") !== null);
  await until(() => document.querySelector<HTMLImageElement>(".pu-annimg img")?.src === "https://example.com/scene.png");
  expect(document.querySelector(".pu-annimg")!.textContent).toContain("cat");
  await until(() => (document.querySelector(".pu-hltext")?.textContent ?? "").includes("hello world"));
  expect(document.querySelector(".pu-hltext")!.textContent).toContain("PLACE");

  box.click();
  await until(() => toggles.length === 1);
  expect(toggles[0]).toBe(false);
  await until(() => !box.checked);
});
