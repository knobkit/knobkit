import { test, expect } from "vitest";
import { knobkit } from "../lib/knobkit.js";
import { chat, log, text } from "../lib/widgets/index.js";
import { declare } from "../lib/declare.js";
import { createStore, type Transport } from "./runtime.js";
import type { Knobkit } from "../lib/knobkit.js";

function storeFor(app: Knobkit) {
  const routed: { type: string; payload: unknown }[] = [];
  const transport: Transport = (type, payload) => routed.push({ type, payload });
  return { store: createStore(declare(app.config, app.serverEvents()), transport), routed };
}

test("applyEdit set/append/appendText mutate structured state by path", () => {
  const convo = chat();
  const lines = log();
  const box = text();
  const app = knobkit({ widgets: [convo, lines, box] });
  const { store } = storeFor(app);

  store.applyEdit(app.keyFor(box), "set", ["value"], "hi");
  expect(store.read(app.keyFor(box), ["value"])).toBe("hi");

  store.applyEdit(app.keyFor(lines), "append", ["lines"], "a");
  store.applyEdit(app.keyFor(lines), "append", ["lines"], "b");
  expect(store.read(app.keyFor(lines), ["lines"])).toEqual(["a", "b"]);

  store.applyEdit(app.keyFor(convo), "append", ["messages"], { role: "assistant", content: "" });
  store.applyEdit(app.keyFor(convo), "appendText", ["messages", -1, "content"], "hel");
  store.applyEdit(app.keyFor(convo), "appendText", ["messages", -1, "content"], "lo");
  expect(store.read(app.keyFor(convo), ["messages"])).toEqual([{ role: "assistant", content: "hello" }]);
});

test("an event routes to the transport only if it has a handler", () => {
  const convo = chat();
  const app = knobkit({ widgets: [convo] }).on(convo.sent, () => {});
  const { store, routed } = storeFor(app);
  store.emit(convo.sent.type, "hi");
  expect(routed).toEqual([{ type: convo.sent.type, payload: "hi" }]);
  store.emit(convo.recorded.type, new Float32Array()); // no handler registered
  expect(routed).toHaveLength(1);
});

test("a disabled widget drops its own input events; enabling restores them", () => {
  const box = text();
  const app = knobkit({ widgets: [box] }).on(box.changed, () => {});
  const { store, routed } = storeFor(app);
  const key = app.keyFor(box);
  store.setEnabled(key, false);
  expect(store.enabled(key)).toBe(false);
  store.emit(box.changed.type, "x");
  expect(routed).toHaveLength(0); // dropped: authoritative
  store.setEnabled(key, true);
  store.emit(box.changed.type, "y");
  expect(routed).toEqual([{ type: box.changed.type, payload: "y" }]);
});

test("read walks a path and returns undefined for a missing one", () => {
  const convo = chat();
  const app = knobkit({ widgets: [convo] });
  const { store } = storeFor(app);
  expect(store.read(app.keyFor(convo), ["messages"])).toEqual([]);
  expect(store.read(app.keyFor(convo), ["nope"])).toBeUndefined();
});
