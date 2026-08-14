import { bound, snapKey } from "./context.js";
import type { Id, Path } from "./types.js";

type Key = string | number;

/** Type at the end of a path: string keys walk objects, numeric keys (incl. -1) walk arrays. */
export type At<T, P extends readonly Key[]> = P extends readonly [infer H extends Key, ...infer R extends readonly Key[]]
  ? At<Step<T, H>, R>
  : T;

type Step<T, H extends Key> = T extends readonly (infer E)[]
  ? H extends number
    ? E
    : never
  : H extends keyof T
    ? T[H]
    : never;

type Element<T> = T extends readonly (infer E)[] ? E : never;

export interface Lens<T> {
  /** @internal */ readonly __target: () => Id;
  readonly path: Path;
  at<P extends Key[]>(...path: P): Lens<At<T, P>>;
  /** Resolves from the dispatch snapshot when present, else a batched read. */
  get(): Promise<T>;
  set(value: T): void;
  append(value: Element<T>): void;
  appendN(values: Element<T>[]): void;
  appendText(text: T extends string ? string : never): void;
  insert(index: number, value: Element<T>): void;
  removeAt(index: number, count?: number): void;
  move(from: number, to: number): void;
  inc(by: T extends number ? number : never): void;
  patch(partial: T extends object ? Partial<T> : never): void;
}

export function makeLens<T>(target: () => Id, path: Path): Lens<T> {
  const edit = (op: string, ...args: unknown[]): void => {
    bound().edit([target(), op as never, path, ...args]);
  };
  return {
    __target: target,
    path,
    at: (...more) => makeLens(target, [...path, ...more]),
    async get() {
      const b = bound();
      const id = target();
      const key = snapKey(id, path);
      if (b.snap?.has(key)) return b.snap.get(key) as T;
      const [value] = await b.read([[id, path]]);
      return value as T;
    },
    set: (v) => edit("set", v),
    append: (v) => edit("append", v),
    appendN: (v) => edit("appendN", v),
    appendText: (v) => edit("appendText", v),
    insert: (i, v) => edit("insert", i, v),
    removeAt: (i, count) => edit("removeAt", i, count ?? 1),
    move: (from, to) => edit("move", from, to),
    inc: (n) => edit("inc", n),
    patch: (p) => edit("patch", p),
  };
}

export function isLens(v: unknown): v is Lens<unknown> {
  return typeof v === "object" && v !== null && typeof (v as Lens<unknown>).__target === "function" && Array.isArray((v as Lens<unknown>).path);
}
