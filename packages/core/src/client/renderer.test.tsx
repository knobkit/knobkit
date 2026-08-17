import { puLayout, puLayoutCol } from "./styles.css.js";
// @vitest-environment jsdom
import { describe, expect, test } from "vitest";
import { knobkit } from "../app.js";
import { defineWidget, idOf } from "../widget.js";
import { mountApp } from "./mount.js";
import { register } from "./registry.js";
import type { ViewProps } from "./view.js";

const renders = new Map<string, number>();

function ProbeView({ id, state, emit }: ViewProps<{ n: number }>) {
  renders.set(id, (renders.get(id) ?? 0) + 1);
  return (
    <button data-probe={id} onClick={() => emit("bump")}>
      {String(state.n)}
    </button>
  );
}

const probe = defineWidget({
  type: "probe",
  state: { n: { initial: 0 } },
  events: { bump: {} },
  ops: (at) => ({ inc: at("n").op("inc", 1) }),
});

register("probe", () => Promise.resolve({ default: ProbeView }));
register("col", () =>
  Promise.resolve({
    default: ({ state, slot }: ViewProps<{ items: string[] }>) => (
      <div className={`${puLayout} ${puLayoutCol}`}>{state.items.map(slot)}</div>
    ),
  }),
);

const until = async (cond: () => boolean, ms = 2000): Promise<void> => {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe("renderer", () => {
  test("mounts, dispatches events, and commits only the touched instance", async () => {
    document.body.innerHTML = `<div id="root"></div>`;
    const a = probe();
    const b = probe();
    const app = knobkit({ title: "T", widgets: [a, b] });
    app.on(a.bump, () => {
      a.inc();
    });

    mountApp(app, "#root");
    await until(() => document.querySelectorAll("[data-probe]").length === 2);
    expect(document.querySelector("h1")?.textContent).toBe("T");

    const aId = idOf(a);
    const bId = idOf(b);
    const before = { a: renders.get(aId) ?? 0, b: renders.get(bId) ?? 0 };

    for (let i = 0; i < 5; i++) {
      document.querySelector<HTMLButtonElement>(`[data-probe="${aId}"]`)!.click();
      await until(() => document.querySelector(`[data-probe="${aId}"]`)!.textContent === String(i + 1));
    }

    expect(document.querySelector(`[data-probe="${aId}"]`)!.textContent).toBe("5");
    expect(renders.get(aId)! - before.a).toBeGreaterThanOrEqual(5);
    expect(renders.get(bId) ?? 0).toBe(before.b); // untouched instance: zero extra commits
  });
});
