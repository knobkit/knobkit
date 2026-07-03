import { expect, test } from "vitest";
import { knobkit, type Knobkit } from "../lib/knobkit.js";
import { declare, type AppDecl } from "../lib/declare.js";
import { button, chat, log, text } from "../lib/widgets/index.js";
import { createStore, type Store, type Transport } from "./runtime.js";

function storeFor(app: Knobkit): { store: Store; routed: { type: string; payload: unknown }[] } {
  const routed: { type: string; payload: unknown }[] = [];
  const transport: Transport = (type, payload) => routed.push({ type, payload });
  return { store: createStore(declare(app.config, app.serverEvents()), transport), routed };
}

test("structured edits update only the targeted widget and preserve immutable cell snapshots", () => {
  const box = text();
  const lines = log();
  const convo = chat();
  const app = knobkit({ widgets: [box, lines, convo] });
  const { store } = storeFor(app);
  const boxKey = app.keyFor(box);
  const linesKey = app.keyFor(lines);
  const convoKey = app.keyFor(convo);
  const beforeBox = store.cell(boxKey);
  const beforeLines = store.cell(linesKey);

  store.applyEdit(boxKey, "set", ["value"], "hello");
  expect(store.read(boxKey, ["value"])).toBe("hello");
  expect(beforeBox.state).toEqual({ value: "" });
  expect(store.cell(boxKey)).not.toBe(beforeBox);
  expect(store.cell(linesKey)).toBe(beforeLines);

  store.applyEdit(linesKey, "append", ["lines"], "first");
  store.applyEdit(linesKey, "append", ["lines"], "second");
  expect(store.read(linesKey, ["lines"])).toEqual(["first", "second"]);

  store.applyEdit(convoKey, "append", ["messages"], { role: "assistant", content: "" });
  store.applyEdit(convoKey, "appendText", ["messages", -1, "content"], "hel");
  store.applyEdit(convoKey, "appendText", ["messages", -1, "content"], "lo");
  expect(store.read(convoKey, ["messages", -1, "content"])).toBe("hello");

  store.applyEdit(boxKey, "set", ["meta", "dirty"], true);
  expect(store.read(boxKey, [])).toEqual({ value: "hello", meta: { dirty: true } });
});

test("subscriptions are key-scoped, unsubscribe cleanly, and no-op flag changes do not notify", () => {
  const box = text();
  const other = text();
  const app = knobkit({ widgets: [box, other] });
  const { store } = storeFor(app);
  const boxKey = app.keyFor(box);
  const otherKey = app.keyFor(other);
  let boxNotifications = 0;
  let otherNotifications = 0;
  const unsubscribeBox = store.subscribe(boxKey, () => {
    boxNotifications++;
  });
  store.subscribe(otherKey, () => {
    otherNotifications++;
  });

  store.applyEdit(boxKey, "set", ["value"], "a");
  expect(boxNotifications).toBe(1);
  expect(otherNotifications).toBe(0);

  store.setEnabled(boxKey, false);
  store.setEnabled(boxKey, false);
  expect(boxNotifications).toBe(2);
  expect(store.enabled(boxKey)).toBe(false);
  expect(store.cell(boxKey).enabled).toBe(false);

  store.setBusy(otherKey, true);
  store.setBusy(otherKey, true);
  expect(otherNotifications).toBe(1);
  expect(store.cell(otherKey).busy).toBe(true);

  unsubscribeBox();
  store.applyEdit(boxKey, "set", ["value"], "b");
  store.setEnabled("missing", false);
  store.applyEdit("missing", "set", ["value"], "ignored");
  expect(boxNotifications).toBe(2);
  expect(otherNotifications).toBe(1);
});

test("events route only for registered handlers and are gated by their source widget state", () => {
  const box = text();
  const run = button({ label: "Run" });
  const app = knobkit({ widgets: [box, run] }).on(box.changed, () => {});
  const { store, routed } = storeFor(app);
  const boxKey = app.keyFor(box);

  store.emit(run.clicked.type, undefined);
  expect(routed).toEqual([]);

  store.emit(box.changed.type, "a");
  expect(routed).toEqual([{ type: box.changed.type, payload: "a" }]);

  store.setBusy(boxKey, true);
  store.emit(box.changed.type, "busy");
  expect(routed).toHaveLength(1);

  store.setBusy(boxKey, false);
  store.setEnabled(boxKey, false);
  store.emit(box.changed.type, "disabled");
  expect(routed).toHaveLength(1);

  store.setEnabled(boxKey, true);
  store.emit(box.changed.type, "b");
  expect(routed).toEqual([
    { type: box.changed.type, payload: "a" },
    { type: box.changed.type, payload: "b" },
  ]);
});

test("server events without a widget owner still route through the transport", () => {
  const decl: AppDecl = {
    widgets: [
      {
        key: "plain-0",
        type: "plain",
        state: { value: "local" },
        enabled: true,
        props: {},
        events: {},
      },
    ],
    root: "plain-0",
    serverEvents: ["external.event"],
  };
  const routed: { type: string; payload: unknown }[] = [];
  const store = createStore(decl, (type, payload) => routed.push({ type, payload }));

  store.emit("external.event", { id: 1 });
  store.setBusy("plain-0", true);
  store.setEnabled("plain-0", false);
  store.emit("external.event", { id: 2 });

  expect(routed).toEqual([
    { type: "external.event", payload: { id: 1 } },
    { type: "external.event", payload: { id: 2 } },
  ]);
});

test("reads return undefined for missing paths without mutating state", () => {
  const convo = chat();
  const app = knobkit({ widgets: [convo] });
  const { store } = storeFor(app);
  const key = app.keyFor(convo);
  const before = store.cell(key);

  expect(store.read(key, ["messages"])).toEqual([]);
  expect(store.read(key, ["messages", -1, "content"])).toBeUndefined();
  expect(store.read(key, ["nope", "nested"])).toBeUndefined();
  expect(store.read("missing", ["anything"])).toBeUndefined();
  expect(store.cell(key)).toBe(before);
});
