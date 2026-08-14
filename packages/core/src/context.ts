import type { Edit } from "./ops.js";
import type { NoteLevel } from "./protocol.js";
import type { Id, Instance, Path } from "./types.js";

export interface Bound {
  session: string;
  corr: string;
  read(targets: [Id, Path][]): Promise<unknown[]>;
  edit(edit: Edit): void;
  mintId(): Id;
  spawn(inst: Instance): Id;
  dispose(id: Id): void;
  note(level: NoteLevel, message: string, src?: Id): void;
  snap?: Map<string, unknown>;
  spans: Map<string, number>;
}

export function snapKey(id: Id, path: Path): string {
  return id + " " + JSON.stringify(path);
}

// Browser default: one module slot, set synchronously at dispatch start and never restored —
// async continuations resolve the latest dispatch's Bound (best-effort until AsyncContext).
// Node replaces both hooks with AsyncLocalStorage, which is exact.
let slot: Bound | undefined;
let resolve: () => Bound | undefined = () => slot;
let runner = <T>(b: Bound, fn: () => T): T => {
  slot = b;
  return fn();
};

export function setContextRunner(
  resolveFn: () => Bound | undefined,
  runFn: <T>(b: Bound, fn: () => T) => T,
): void {
  resolve = resolveFn;
  runner = runFn;
}

export function runBound<T>(b: Bound, fn: () => T): T {
  return runner(b, fn);
}

export function bound(): Bound {
  const b = resolve();
  if (!b) throw new Error("knobkit: widget method called outside a handler/setup");
  return b;
}

export function createReadBatcher(
  issue: (targets: [Id, Path][]) => Promise<unknown[]>,
): (target: [Id, Path]) => Promise<unknown> {
  let pending: { targets: [Id, Path][]; resolvers: Array<(v: unknown) => void>; rejecters: Array<(e: unknown) => void> } | null = null;

  return (target) =>
    new Promise((resolvePromise, rejectPromise) => {
      if (!pending) {
        const batch = { targets: [] as [Id, Path][], resolvers: [] as Array<(v: unknown) => void>, rejecters: [] as Array<(e: unknown) => void> };
        pending = batch;
        queueMicrotask(() => {
          pending = null;
          issue(batch.targets).then(
            (values) => batch.resolvers.forEach((r, i) => r(values[i])),
            (err) => batch.rejecters.forEach((r) => r(err)),
          );
        });
      }
      pending.targets.push(target);
      pending.resolvers.push(resolvePromise);
      pending.rejecters.push(rejectPromise);
    });
}
