import type { Path } from "./types.js";

/** Read the value at a path; `-1` = last array element; missing → undefined. */
export function readAt(node: unknown, path: Path): unknown {
  for (const p of path) {
    if (node == null) return undefined;
    if (Array.isArray(node)) {
      node = node[p === -1 ? node.length - 1 : (p as number)];
    } else {
      node = (node as Record<string, unknown>)[p as string];
    }
  }
  return node;
}

export function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i]);
}

/** Is `b` equal to or nested under `a`? (Conservative: `-1` and a concrete index never match.) */
export function atOrUnder(a: Path, b: Path): boolean {
  return a.length <= b.length && a.every((p, i) => p === b[i]);
}
