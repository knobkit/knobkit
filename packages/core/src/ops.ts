import { atOrUnder, samePath } from "./path.js";
import type { Id, Instance, Path } from "./types.js";

export type OpName =
  | "set"
  | "append"
  | "appendN"
  | "appendText"
  | "insert"
  | "removeAt"
  | "move"
  | "inc"
  | "patch"
  | "instanceAdd"
  | "instanceRemove";

export type Edit = [id: Id, op: OpName, path: Path, ...args: unknown[]];

export function applyOp(node: unknown, op: OpName, args: unknown[]): unknown {
  switch (op) {
    case "set":
      return args[0];
    case "append":
      return [...((node as unknown[]) ?? []), args[0]];
    case "appendN":
      return [...((node as unknown[]) ?? []), ...(args[0] as unknown[])];
    case "appendText":
      return ((node as string) ?? "") + (args[0] as string);
    case "insert": {
      const arr = [...((node as unknown[]) ?? [])];
      arr.splice(index(arr, args[0] as number, arr.length), 0, args[1]);
      return arr;
    }
    case "removeAt": {
      const arr = [...((node as unknown[]) ?? [])];
      arr.splice(index(arr, args[0] as number, arr.length - 1), (args[1] as number) ?? 1);
      return arr;
    }
    case "move": {
      const arr = [...((node as unknown[]) ?? [])];
      const [item] = arr.splice(index(arr, args[0] as number, arr.length - 1), 1);
      arr.splice(index(arr, args[1] as number, arr.length), 0, item);
      return arr;
    }
    case "inc":
      return ((node as number) ?? 0) + (args[0] as number);
    case "patch":
      return { ...((node as object) ?? {}), ...(args[0] as object) };
    default:
      throw new Error(`knobkit: op "${op}" does not apply to a value`);
  }
}

// `-1` (and other negatives) count from the end, mirroring path addressing.
function index(arr: unknown[], i: number, fallback: number): number {
  if (typeof i !== "number" || Number.isNaN(i)) return fallback;
  return i < 0 ? Math.max(0, arr.length + i) : Math.min(i, arr.length);
}

export function editAt(node: unknown, path: Path, op: OpName, args: unknown[]): unknown {
  if (path.length === 0) return applyOp(node, op, args);
  const [head, ...rest] = path as [string | number, ...Path];
  if (Array.isArray(node)) {
    const i = head === -1 ? node.length - 1 : (head as number);
    const copy = node.slice();
    copy[i] = editAt(node[i], rest, op, args);
    return copy;
  }
  const obj = (node ?? {}) as Record<string, unknown>;
  return { ...obj, [head as string]: editAt(obj[head as string], rest, op, args) };
}

// Coalescing must be order-equivalent to applying the originals (property-tested). `set` may
// absorb prior ops only at the same or a descendant path, never across instanceAdd/instanceRemove.
export function pushEdit(queue: Edit[], edit: Edit): void {
  const [id, op, path] = edit;

  if (op === "set") {
    while (queue.length > 0) {
      const [lid, lop, lpath] = queue[queue.length - 1]!;
      if (lid === id && lop !== "instanceAdd" && lop !== "instanceRemove" && atOrUnder(path, lpath)) queue.pop();
      else break;
    }
    queue.push(edit);
    return;
  }

  const last = queue[queue.length - 1];
  if (last && last[0] === id && samePath(last[2], path)) {
    const [, lop, , ...largs] = last;
    const args = edit.slice(3);
    if (op === "append" && lop === "append") {
      queue[queue.length - 1] = [id, "appendN", path, [largs[0], args[0]]];
      return;
    }
    if (op === "append" && lop === "appendN") {
      queue[queue.length - 1] = [id, "appendN", path, [...(largs[0] as unknown[]), args[0]]];
      return;
    }
    if (op === "appendN" && (lop === "appendN" || lop === "append")) {
      const prior = lop === "append" ? [largs[0]] : (largs[0] as unknown[]);
      queue[queue.length - 1] = [id, "appendN", path, [...prior, ...(args[0] as unknown[])]];
      return;
    }
    if (op === "appendText" && lop === "appendText") {
      queue[queue.length - 1] = [id, "appendText", path, (largs[0] as string) + (args[0] as string)];
      return;
    }
    if (op === "inc" && lop === "inc") {
      queue[queue.length - 1] = [id, "inc", path, (largs[0] as number) + (args[0] as number)];
      return;
    }
    if (op === "patch" && lop === "patch") {
      queue[queue.length - 1] = [id, "patch", path, { ...(largs[0] as object), ...(args[0] as object) }];
      return;
    }
  }
  queue.push(edit);
}

export function coalesce(edits: Edit[]): Edit[] {
  const queue: Edit[] = [];
  for (const e of edits) pushEdit(queue, e);
  return queue;
}

export function instanceAddEdit(id: Id, inst: Instance): Edit {
  return [id, "instanceAdd", [], inst];
}

export function instanceRemoveEdit(id: Id): Edit {
  return [id, "instanceRemove", []];
}
