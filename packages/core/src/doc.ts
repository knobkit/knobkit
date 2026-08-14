import { editAt } from "./ops.js";
import type { Edit } from "./ops.js";
import { readAt } from "./path.js";
import { scanMediaRefs } from "./types.js";
import type { Doc, Instance, MediaRef } from "./types.js";

export interface ReduceFx {
  refEnter?(ref: MediaRef): void;
  refLeave?(ref: MediaRef): void;
}

export function emptyDoc(): Doc {
  return { instances: {} };
}

export function reduce(doc: Doc, edit: Edit, fx?: ReduceFx): Doc {
  const [id, op, path, ...args] = edit;

  if (op === "instanceAdd") {
    const inst = args[0] as Instance;
    if (fx?.refEnter) scanMediaRefs(inst.state, fx.refEnter);
    return { instances: { ...doc.instances, [id]: inst } };
  }

  if (op === "instanceRemove") {
    const inst = doc.instances[id];
    if (!inst) return doc;
    if (fx?.refLeave) scanMediaRefs(inst.state, fx.refLeave);
    const instances = { ...doc.instances };
    delete instances[id];
    return { instances };
  }

  const inst = doc.instances[id];
  if (!inst) return doc;

  if (fx?.refEnter || fx?.refLeave) {
    // Refs leave in what the op overwrites/removes; enter in what it adds.
    const cur = () => readAt(inst.state, path);
    if (op === "set") {
      if (fx.refLeave) scanMediaRefs(cur(), fx.refLeave);
      if (fx.refEnter) scanMediaRefs(args[0], fx.refEnter);
    } else if (op === "append" || op === "insert") {
      if (fx.refEnter) scanMediaRefs(op === "insert" ? args[1] : args[0], fx.refEnter);
    } else if (op === "appendN") {
      if (fx.refEnter) scanMediaRefs(args[0], fx.refEnter);
    } else if (op === "removeAt") {
      const arr = (cur() as unknown[]) ?? [];
      const i = (args[0] as number) < 0 ? arr.length + (args[0] as number) : (args[0] as number);
      if (fx.refLeave) scanMediaRefs(arr.slice(i, i + ((args[1] as number) ?? 1)), fx.refLeave);
    } else if (op === "patch") {
      const prev = (cur() as Record<string, unknown>) ?? {};
      for (const [k, v] of Object.entries(args[0] as Record<string, unknown>)) {
        if (fx.refLeave && k in prev) scanMediaRefs(prev[k], fx.refLeave);
        if (fx.refEnter) scanMediaRefs(v, fx.refEnter);
      }
    }
  }

  const state = editAt(inst.state, path, op, args) as Record<string, unknown>;
  return { instances: { ...doc.instances, [id]: { ...inst, state } } };
}

export function reduceAll(doc: Doc, edits: Edit[], fx?: ReduceFx): Doc {
  for (const e of edits) doc = reduce(doc, e, fx);
  return doc;
}
