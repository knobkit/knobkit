// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { knobkit, type Knobkit } from "../lib/knobkit.js";
import { declare, type AppDecl } from "../lib/declare.js";
import { button, col, density, grid, grow, log, output, row, span, text, theme } from "../lib/widgets/index.js";
import { App, render as renderKnobkit } from "./app.js";
import { createStore, type Store, type Transport } from "./runtime.js";

let root: Root | undefined;

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-density");
  document.documentElement.removeAttribute("data-fill");
});

function createHarness(app: Knobkit): {
  decl: AppDecl;
  store: Store;
  routed: { type: string; payload: unknown }[];
} {
  const routed: { type: string; payload: unknown }[] = [];
  const transport: Transport = (type, payload) => routed.push({ type, payload });
  const decl = declare(app.config, app.serverEvents());
  return { decl, store: createStore(decl, transport), routed };
}

async function mountApp(decl: AppDecl, store: Store): Promise<void> {
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root!.render(<App decl={decl} store={store} />);
  });
}

async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  await act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

test("input views receive props, update their own store cell, and route only handled events", async () => {
  const handled = text({ placeholder: "Handled", lines: 2 });
  const localOnly = text({ placeholder: "Local only" });
  const app = knobkit({ title: "Inputs", description: "Local and routed", widgets: [handled, localOnly] }).on(
    handled.changed,
    () => {},
  );
  const { decl, store, routed } = createHarness(app);
  await mountApp(decl, store);

  expect(document.querySelector("h1")?.textContent).toBe("Inputs");
  expect(document.querySelector(".pu-desc")?.textContent).toBe("Local and routed");

  const textarea = document.querySelector("textarea")!;
  const input = document.querySelector("input")!;
  expect(textarea.placeholder).toBe("Handled");
  expect(textarea.rows).toBe(2);
  expect(input.placeholder).toBe("Local only");

  await typeInto(textarea, "server value");
  await typeInto(input, "local value");

  expect(textarea.value).toBe("server value");
  expect(input.value).toBe("local value");
  expect(store.read(app.keyFor(handled), ["value"])).toBe("server value");
  expect(store.read(app.keyFor(localOnly), ["value"])).toBe("local value");
  expect(routed).toEqual([{ type: handled.changed.type, payload: "server value" }]);
});

test("field shell and child view stay in sync with enabled and busy state", async () => {
  const run = button({ label: "Run" });
  const app = knobkit({ widgets: [run] }).on(run.clicked, () => {});
  const { decl, store, routed } = createHarness(app);
  await mountApp(decl, store);

  const key = app.keyFor(run);
  const btn = document.querySelector("button")!;
  const shell = btn.closest(".pu-field")!;

  await click(btn);
  expect(routed).toEqual([{ type: run.clicked.type, payload: undefined }]);

  await act(async () => {
    store.setEnabled(key, false);
  });
  expect(btn.disabled).toBe(true);
  expect(shell.classList.contains("pu-disabled")).toBe(true);

  await act(async () => {
    store.setEnabled(key, true);
    store.setBusy(key, true);
  });
  expect(btn.disabled).toBe(false);
  expect(shell.classList.contains("pu-disabled")).toBe(false);
  expect(shell.classList.contains("pu-busy")).toBe(true);
  expect(shell.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe("Loading");

  await click(btn);
  expect(routed).toHaveLength(1);

  await act(async () => {
    store.setBusy(key, false);
  });
  await click(btn);
  expect(routed).toEqual([
    { type: run.clicked.type, payload: undefined },
    { type: run.clicked.type, payload: undefined },
  ]);
});

test("recursive slots follow container item state when children are reordered or removed", async () => {
  const query = text({ placeholder: "Search" });
  const run = button({ label: "Run" });
  const result = output();
  const trace = log();
  const app = knobkit({ widgets: col(row(query, run), result, trace) });
  const { decl, store } = createHarness(app);
  await mountApp(decl, store);

  const rootKey = decl.root;
  const rowKey = store.read(rootKey, ["items", 0]) as string;
  const resultKey = app.keyFor(result);
  const traceKey = app.keyFor(trace);

  const rowEl = document.querySelector(".pu-layout-row")!;
  expect(rowEl.querySelector("input")?.getAttribute("placeholder")).toBe("Search");
  expect(rowEl.querySelector("button")?.textContent).toBe("Run");
  expect(rowEl.querySelector(".pu-output")).toBeNull();
  expect(document.querySelector(".pu-log")).not.toBeNull();

  await act(async () => {
    store.applyEdit(rootKey, "set", ["items"], [resultKey]);
  });
  expect(document.querySelector(".pu-layout-row")).toBeNull();
  expect(document.querySelector(".pu-log")).toBeNull();
  expect(document.querySelector(".pu-output")?.textContent).toBe("—");

  await act(async () => {
    store.applyEdit(rootKey, "set", ["items"], [traceKey, rowKey]);
  });
  expect(document.querySelector(".pu-log")).not.toBeNull();
  expect(document.querySelector(".pu-layout-row")).not.toBeNull();
  expect(document.querySelector(".pu-output")).toBeNull();
});

test("field wrapper applies layout span, growth, density, and theme props around the view", async () => {
  const name = theme(density(grow(span(text(), { cols: 2, rows: 3 })), "sm"), "dark");
  const app = knobkit({ widgets: grid([name], { cols: 4 }) });
  const { decl, store } = createHarness(app);
  await mountApp(decl, store);

  const gridEl = document.querySelector(".pu-layout-grid") as HTMLElement;
  const input = document.querySelector("input")!;
  const shell = input.closest(".pu-field") as HTMLElement;

  expect(gridEl.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  expect(shell.classList.contains("pu-field-grow")).toBe(true);
  expect(shell.style.gridColumn).toBe("span 2");
  expect(shell.style.gridRow).toBe("span 3");
  expect(shell.dataset.density).toBe("sm");
  expect(shell.dataset.theme).toBe("dark");
});

test("render entrypoint applies document config and mounts a store-backed app", async () => {
  const prompt = text({ placeholder: "Rendered input" });
  const app = knobkit({ title: "Rendered", theme: "dark", density: "lg", fill: true, widgets: [prompt] }).on(
    prompt.changed,
    () => {},
  );
  const { decl, store, routed } = createHarness(app);

  document.body.innerHTML = '<main id="host"></main>';
  await act(async () => {
    renderKnobkit(decl, store, document.getElementById("host")!);
  });

  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.dataset.density).toBe("lg");
  expect(document.documentElement.dataset.fill).toBe("");
  expect(document.querySelector("h1")?.textContent).toBe("Rendered");

  const input = document.querySelector("input") as HTMLInputElement;
  await typeInto(input, "from render");

  expect(store.read(app.keyFor(prompt), ["value"])).toBe("from render");
  expect(routed).toEqual([{ type: prompt.changed.type, payload: "from render" }]);
});

test("missing slot keys and unregistered widget views do not block known siblings", async () => {
  const visible = output();
  const app = knobkit({ title: "Resilient", widgets: [visible] });
  const baseDecl = declare(app.config, app.serverEvents());
  const unknown = {
    key: "custom-unknown",
    type: "notRegistered",
    state: { value: "hidden" },
    enabled: true,
    props: {},
    events: {},
  };
  const decl: AppDecl = {
    ...baseDecl,
    widgets: [
      ...baseDecl.widgets.map((wd) =>
        wd.key === baseDecl.root
          ? { ...wd, state: { items: [unknown.key, "missing-child-key", app.keyFor(visible)] } }
          : wd,
      ),
      unknown,
    ],
  };
  const store = createStore(decl, () => {});
  await mountApp(decl, store);

  expect(document.querySelector("h1")?.textContent).toBe("Resilient");
  expect(document.querySelectorAll(".pu-field")).toHaveLength(2);
  expect(document.querySelector(".pu-output")?.textContent).toBe("—");

  await act(async () => {
    store.applyEdit(app.keyFor(visible), "set", ["value"], "still rendered");
  });

  expect(document.querySelector(".pu-output")?.textContent).toBe("still rendered");
});
