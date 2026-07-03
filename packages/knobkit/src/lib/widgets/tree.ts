import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  hasChildren?: boolean;
  data?: unknown;
}

export type TreeState = { nodes: TreeNode[]; expanded: string[]; selected: string | null; editing: string | null };

export interface TreeWidget extends Widget<TreeState> {
  selected: EventCtor<{ id: string; data?: unknown }>;
  activated: EventCtor<{ id: string; data?: unknown }>;
  expanded: EventCtor<{ id: string }>;
  collapsed: EventCtor<{ id: string }>;
  contextmenu: EventCtor<{ id: string; x: number; y: number; data?: unknown }>;
  renamed: EventCtor<{ id: string; name: string }>;
  nodes(): Promise<TreeNode[]>;
  selection(): Promise<string | null>;
  setNodes(nodes: TreeNode[]): void;
  select(id: string | null): void;
  setSelected(id: string | null): void;
  expand(id: string): Promise<void>;
  collapse(id: string): Promise<void>;
  setChildren(id: string, children: TreeNode[]): Promise<void>;
  rename(id: string): void;
}

export type TreeOptions = { nodes?: TreeNode[]; expanded?: string[]; selected?: string | null };

function mapNode(nodes: TreeNode[], id: string, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) =>
    n.id === id ? fn(n) : n.children ? { ...n, children: mapNode(n.children, id, fn) } : n,
  );
}

function normalizeOptions(opts: TreeOptions | TreeNode[]): TreeOptions {
  return Array.isArray(opts) ? { nodes: opts } : opts;
}

export function tree(opts: TreeOptions | TreeNode[] = {}): TreeWidget {
  const normalized = normalizeOptions(opts);
  return {
    type: "tree",
    state: {
      nodes: normalized.nodes ?? [],
      expanded: normalized.expanded ?? [],
      selected: normalized.selected ?? null,
      editing: null,
    },
    selected: event<{ id: string; data?: unknown }>("tree.selected"),
    activated: event<{ id: string; data?: unknown }>("tree.activated"),
    expanded: event<{ id: string }>("tree.expanded"),
    collapsed: event<{ id: string }>("tree.collapsed"),
    contextmenu: event<{ id: string; x: number; y: number; data?: unknown }>("tree.contextmenu"),
    renamed: event<{ id: string; name: string }>("tree.renamed"),
    ...controls,
    nodes(): Promise<TreeNode[]> {
      return bound(this).read<TreeNode[]>(this, ["nodes"]);
    },
    selection(): Promise<string | null> {
      return bound(this).read<string | null>(this, ["selected"]);
    },
    setNodes(nodes: TreeNode[]): void {
      bound(this).edit(this, "set", ["nodes"], nodes);
    },
    select(id: string | null): void {
      bound(this).edit(this, "set", ["selected"], id);
    },
    setSelected(id: string | null): void {
      bound(this).edit(this, "set", ["selected"], id);
    },
    async expand(id: string): Promise<void> {
      const b = bound(this);
      const cur = await b.read<string[]>(this, ["expanded"]);
      if (!cur.includes(id)) b.edit(this, "set", ["expanded"], [...cur, id]);
    },
    async collapse(id: string): Promise<void> {
      const b = bound(this);
      const cur = await b.read<string[]>(this, ["expanded"]);
      b.edit(this, "set", ["expanded"], cur.filter((x) => x !== id));
    },
    async setChildren(id: string, children: TreeNode[]): Promise<void> {
      const b = bound(this);
      const nodes = await b.read<TreeNode[]>(this, ["nodes"]);
      b.edit(this, "set", ["nodes"], mapNode(nodes, id, (n) => ({ ...n, children })));
    },
    rename(id: string): void {
      bound(this).edit(this, "set", ["editing"], id);
    },
  };
}
