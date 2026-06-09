import "./styles.css";
import type { Knobkit } from "../lib/knobkit.js";
import type { Event } from "../lib/types.js";
import { declare } from "../lib/declare.js";
import { makeBound } from "../lib/ctx.js";
import { createStore, type Store, type Transport } from "./runtime.js";
import { render } from "./app.js";
import { run } from "./context.js";

const isEvent = (x: any): x is Event => x != null && typeof x.type === "string" && "payload" in x;

// DOM-only, no server: the browser owns state AND runs the `on(...)` handlers locally. Same store and
// views as serve mode; the transport invokes the knobkit's handlers in-place with a context that reads the
// local store and applies edits to it directly. Produced events go straight back onto the store.
export function mount(knobkit: Knobkit, selector: string): void {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`knobkit: no element matches "${selector}"`);
  const decl = declare(knobkit.config, knobkit.serverEvents());

  let store: Store;
  const localBound = () =>
    makeBound({
      read: (key, path) => Promise.resolve(store.read(key, path)),
      edit: (key, op, path, value) => store.applyEdit(key, op, path, value),
      enable: (key, value) => store.setEnabled(key, value),
      busy: (key, value) => store.setBusy(key, value),
      keyFor: (w) => knobkit.keyFor(w),
    });

  const transport: Transport = (type, payload) => {
    const bound = localBound();
    void (async () => {
      for (const handler of knobkit.handlers.get(type) ?? []) {
        await run(bound, async () => {
          const r = await handler(payload);
          if (isEvent(r)) store.emit(r.type, r.payload);
        });
      }
    })();
  };

  store = createStore(decl, transport);
  render(decl, store, el);

  void (async () => {
    for (const fn of knobkit.setups) await run(localBound(), fn);
  })();
}
