import { readAt } from "../path.js";
import type { Id, Path } from "../types.js";
import type { Store } from "./store.js";

export interface WatchTable {
  add(wid: number, target: [Id, Path], throttleMs?: number): void;
  remove(wid: number): void;
  /** Hook this to store.onChange. */
  check(dirty: ReadonlySet<Id>): void;
}

interface WatchState {
  target: [Id, Path];
  throttleMs: number;
  last: unknown;
  lastFired: number;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createWatchTable(
  store: Store,
  fire: (wid: number, value: unknown, target: [Id, Path]) => void,
): WatchTable {
  const watches = new Map<number, WatchState>();

  const evaluate = (wid: number, w: WatchState): void => {
    const value = store.readAt(w.target[0], w.target[1]);
    if (Object.is(value, w.last)) return;
    const now = Date.now();
    const wait = w.lastFired + w.throttleMs - now;
    if (wait > 0) {
      if (!w.timer) {
        w.timer = setTimeout(() => {
          w.timer = null;
          evaluate(wid, w);
        }, wait);
      }
      return;
    }
    w.last = value;
    w.lastFired = now;
    fire(wid, value, w.target);
  };

  return {
    add(wid, target, throttleMs = 0) {
      watches.set(wid, {
        target,
        throttleMs,
        last: store.readAt(target[0], target[1]),
        lastFired: -Infinity,
        timer: null,
      });
    },
    remove(wid) {
      const w = watches.get(wid);
      if (w?.timer) clearTimeout(w.timer);
      watches.delete(wid);
    },
    check(dirty) {
      for (const [wid, w] of watches) {
        if (dirty.has(w.target[0])) evaluate(wid, w);
      }
    },
  };
}
