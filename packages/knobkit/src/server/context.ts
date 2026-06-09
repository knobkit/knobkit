import { AsyncLocalStorage } from "node:async_hooks";
import { setBoundResolver, type Bound } from "../lib/bound.js";

// Per-request context binding for handlers. Each socket request runs inside `run(bound, …)`, so a
// widget method's `bound(this)` resolves to that request's snapshot reader / event sender even across
// awaits and concurrent requests.
const store = new AsyncLocalStorage<Bound>();
setBoundResolver(() => store.getStore());

export function run<T>(bound: Bound, fn: () => T): T {
  return store.run(bound, fn);
}
