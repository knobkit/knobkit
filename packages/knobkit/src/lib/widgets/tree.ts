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
}

type TreeState = { nodes: TreeNode[]; expanded: string[]; selected: string | null };

export interface TreeWidget extends Widget<TreeState> {
  selected: EventCtor<{ id: string }>;
  activated: EventCtor<{ id: string }>;
  expanded: EventCtor<{ id: string }>;
  collapsed: EventCtor<{ id: string }>;
  nodes(): Promise<TreeNode[]>;
  selection(): Promise<string | null>;
  setNodes(nodes: TreeNode[]): void;
  select(id: string | null): void;
  expand(id: string): Promise<void>;
  collapse(id: string): Promise<void>;
  setChildren(id: string, children: TreeNode[]): Promise<void>;
}

function mapNode(nodes: TreeNode[], id: string, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) =>
    n.id === id ? fn(n) : n.children ? { ...n, children: mapNode(n.children, id, fn) } : n,
  );
}

export function tree(opts: { nodes?: TreeNode[]; expanded?: string[]; selected?: string | null } = {}): TreeWidget {
  return {
    type: "tree",
    state: { nodes: opts.nodes ?? [], expanded: opts.expanded ?? [], selected: opts.selected ?? null },
    selected: event<{ id: string }>("tree.selected"),
    activated: event<{ id: string }>("tree.activated"),
    expanded: event<{ id: string }>("tree.expanded"),
    collapsed: event<{ id: string }>("tree.collapsed"),
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
  };
}
