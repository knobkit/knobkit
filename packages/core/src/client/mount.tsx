import type { App } from "../app.js";
import type { Bound } from "../context.js";
import { createDispatcher } from "../dispatch.js";
import { setMediaStore } from "../media.js";
import { snapKey } from "../context.js";
import type { Id, Path } from "../types.js";
import { createClientMediaStore } from "./media.js";
import { createNotesHub } from "./notes.js";
import { renderApp } from "./render.js";
import { createStore } from "./store.js";
import type { Store } from "./store.js";
import { createWatchTable } from "./watch-table.js";

const DEV = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export function collectSnap(app: App, id: Id, name: string, store: Store): [Id, Path, unknown][] | undefined {
  const targets = new Map<string, [Id, Path]>();
  for (const sub of app.subs) {
    if (sub.name !== name) continue;
    for (const lens of sub.opts.snap ?? []) {
      const target: [Id, Path] = [lens.__target(), lens.path];
      targets.set(snapKey(...target), target);
    }
  }
  if (targets.size === 0) return undefined;
  return [...targets.values()].map(([tid, path]) => [tid, path, store.readAt(tid, path)]);
}

export function mountApp(app: App, selector: string): void {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`knobkit: no element matches "${selector}"`);

  const media = createClientMediaStore(false);
  setMediaStore(media);

  const doc = app.declare();
  const store = createStore(doc, { refEnter: (r) => media.pin(r), refLeave: (r) => media.unpin(r) });
  const notes = createNotesHub(DEV);
  const spans = new Map<string, number>();
  let corrN = 0;
  let spawnN = 0;
  const mint = (): string => `c${corrN++}`;

  const makeBound = (corr: string, snap?: Map<string, unknown>): Bound => ({
    session: "mount",
    corr,
    snap,
    spans,
    read: async (targets) => targets.map(([id, path]) => store.readAt(id, path)),
    edit: (e) => store.apply([e]),
    mintId: () => `#s${spawnN++}`,
    spawn(inst) {
      const id = this.mintId();
      store.apply([[id, "instanceAdd", [], inst]]);
      return id;
    },
    dispose: (id) => store.apply([[id, "instanceRemove", []]]),
    note: (level, message) => notes.push(level, message),
  });

  const dispatcher = createDispatcher(app, {
    session: "mount",
    makeBound,
    note: (level, message, extra) => notes.push(level, message, extra),
    gated: (id) => store.gated(id),
  });

  const watchTable = createWatchTable(store, (wid, value) => dispatcher.dispatchWatch(wid, value, mint()));
  for (const w of app.watches) watchTable.add(w.wid, [w.lens.__target(), w.lens.path], w.throttleMs);
  store.onChange((dirty) => watchTable.check(dirty));

  renderApp(
    {
      store,
      emit: (id, name, payload) => dispatcher.dispatchEvent(id, name, payload, mint(), collectSnap(app, id, name, store)),
      send: (id, name, data) => dispatcher.dispatchChan(id, name, data, mint()),
    },
    notes,
    el,
  );

  void dispatcher.runSetups(mint());
}
