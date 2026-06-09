import type { AppDecl } from "../lib/declare.js";
import type { EditOp, Path } from "../lib/bound.js";

// Routes an event to its handler(s): serve emits it over the socket, mount runs the handlers in-place.
export type Transport = (type: string, payload: unknown) => void;

// A widget's renderable cell: its structured state plus its enabled/busy flags. Replaced as a unit on
// change so a view can subscribe to one stable reference.
export interface Cell {
  state: unknown;
  enabled: boolean;
  busy: boolean;
}

export interface Store {
  emit(type: string, payload: unknown): void;
  applyEdit(key: string, op: EditOp, path: Path, value: unknown): void;
  setEnabled(key: string, value: boolean): void;
  setBusy(key: string, value: boolean): void;
  read(key: string, path: Path): unknown;
  cell(key: string): Cell;
  enabled(key: string): boolean;
  subscribe(key: string, fn: () => void): () => void;
}

function readAt(node: any, path: Path): unknown {
  for (const p of path) {
    if (node == null) return undefined;
    node = Array.isArray(node) && p === -1 ? node[node.length - 1] : node[p as keyof typeof node];
  }
  return node;
}

// Immutably apply one structured edit at a path. -1 addresses an array's last element.
function editAt(node: any, path: Path, op: EditOp, value: unknown): any {
  if (path.length === 0) {
    if (op === "set") return value;
    if (op === "append") return [...((node as unknown[]) ?? []), value];
    return ((node as string) ?? "") + (value as string); // appendText
  }
  const [head, ...rest] = path;
  if (Array.isArray(node)) {
    const i = head === -1 ? node.length - 1 : (head as number);
    const copy = node.slice();
    copy[i] = editAt(node[i], rest, op, value);
    return copy;
  }
  return { ...(node as object), [head as string]: editAt(node?.[head as keyof typeof node], rest, op, value) };
}

// The browser owns all state as structured JSON, one cell per widget. The store has no per-widget
// logic: events route to handlers (gated by enabled), edits apply generically by path, reads walk a
// path. A change notifies only that widget's subscribers — rendering is per-key.
export function createStore(decl: AppDecl, transport: Transport): Store {
  const cells = new Map<string, Cell>();
  const listeners = new Map<string, Set<() => void>>();
  const owner = new Map<string, string>(); // an event type -> the widget key that emits it
  const serverEvents = new Set(decl.serverEvents);

  for (const w of decl.widgets) {
    cells.set(w.key, { state: w.state, enabled: w.enabled, busy: false });
    for (const t of Object.values(w.events)) owner.set(t, w.key);
  }

  const notify = (key: string): void => {
    for (const fn of listeners.get(key) ?? []) fn();
  };

  const applyEdit = (key: string, op: EditOp, path: Path, value: unknown): void => {
    const cur = cells.get(key);
    if (!cur) return;
    cells.set(key, { ...cur, state: editAt(cur.state, path, op, value) });
    notify(key);
  };

  const setEnabled = (key: string, value: boolean): void => {
    const cur = cells.get(key);
    if (!cur || cur.enabled === value) return;
    cells.set(key, { ...cur, enabled: value });
    notify(key);
  };

  const setBusy = (key: string, value: boolean): void => {
    const cur = cells.get(key);
    if (!cur || cur.busy === value) return;
    cells.set(key, { ...cur, busy: value });
    notify(key);
  };

  function emit(type: string, payload: unknown): void {
    const src = owner.get(type);
    const c = src ? cells.get(src) : undefined;
    if (c && (c.enabled === false || c.busy)) return; // a disabled or busy widget drops its own input events
    if (serverEvents.has(type)) transport(type, payload);
  }

  return {
    emit,
    applyEdit,
    setEnabled,
    setBusy,
    read: (key, path) => readAt(cells.get(key)?.state, path),
    cell: (key) => cells.get(key)!,
    enabled: (key) => cells.get(key)?.enabled !== false,
    subscribe: (key, fn) => {
      const subs = listeners.get(key) ?? new Set<() => void>();
      subs.add(fn);
      listeners.set(key, subs);
      return () => subs.delete(fn);
    },
  };
}
