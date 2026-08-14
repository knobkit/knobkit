import { reduce } from "../doc.js";
import type { ReduceFx } from "../doc.js";
import { readAt } from "../path.js";
import type { Edit } from "../ops.js";
import { BUSY, ENABLED } from "../types.js";
import type { Doc, Id, Instance, Path } from "../types.js";

export interface Store {
  doc(): Doc;
  get(id: Id): Instance | undefined;
  apply(edits: Edit[]): void;
  readAt(id: Id, path: Path): unknown;
  subscribe(id: Id, fn: () => void): () => void;
  setLocal(id: Id, path: Path, value: unknown): void;
  gated(id: Id): boolean;
  onChange(fn: (dirty: ReadonlySet<Id>) => void): () => void;
}

export function createStore(initial: Doc, fx?: ReduceFx): Store {
  let doc = initial;
  const listeners = new Map<Id, Set<() => void>>();
  const changeHooks = new Set<(dirty: ReadonlySet<Id>) => void>();
  const dirty = new Set<Id>();
  let notifyScheduled = false;

  const scheduleNotify = (): void => {
    if (notifyScheduled) return;
    notifyScheduled = true;
    const run = (): void => {
      notifyScheduled = false;
      const ids = [...dirty];
      dirty.clear();
      for (const id of ids) for (const fn of listeners.get(id) ?? []) fn();
    };
    if (typeof requestAnimationFrame === "function" && typeof document !== "undefined" && !document.hidden) {
      requestAnimationFrame(run);
    } else {
      queueMicrotask(run);
    }
  };

  const apply = (edits: Edit[]): void => {
    const touched = new Set<Id>();
    for (const e of edits) {
      doc = reduce(doc, e, fx);
      touched.add(e[0]);
    }
    for (const id of touched) dirty.add(id);
    scheduleNotify();
    for (const hook of changeHooks) hook(touched);
  };

  return {
    doc: () => doc,
    get: (id) => doc.instances[id],
    apply,
    readAt: (id, path) => readAt(doc.instances[id]?.state, path),
    subscribe(id, fn) {
      let subs = listeners.get(id);
      if (!subs) {
        subs = new Set();
        listeners.set(id, subs);
      }
      subs.add(fn);
      return () => subs.delete(fn);
    },
    setLocal(id, path, value) {
      apply([[id, "set", path, value]]);
    },
    gated(id) {
      const s = doc.instances[id]?.state;
      return s ? s[ENABLED] === false || s[BUSY] === true : false;
    },
    onChange(fn) {
      changeHooks.add(fn);
      return () => changeHooks.delete(fn);
    },
  };
}
