import { setBoundResolver, type Bound } from "../lib/bound.js";

// Browser context binding for mount mode, where handlers run in-process. There is no AsyncLocalStorage
// in the browser, so the current context is a module global set around each handler run. This is
// correct for one in-flight handler at a time (the common case); overlapping async handlers would
// share it.
let current: Bound | undefined;
setBoundResolver(() => current);

export async function run(bound: Bound, fn: () => unknown): Promise<void> {
  current = bound;
  try {
    await fn();
  } finally {
    current = undefined;
  }
}
