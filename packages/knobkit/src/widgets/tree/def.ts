import { defineWidget, t, viewRef } from "@knobkit/core";

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  hasChildren?: boolean;
  data?: unknown;
}

export interface TreeOptions {
  nodes?: TreeNode[];
  expanded?: string[];
  selected?: string | null;
}

function mapNode(nodes: TreeNode[], id: string, fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map((n) => (n.id === id ? fn(n) : n.children ? { ...n, children: mapNode(n.children, id, fn) } : n));
}

const treeDef = defineWidget({
  type: "tree",
  size: { y: "fill" },
  state: {
    nodes: { initial: [] as TreeNode[] },
    expanded: { initial: [] as string[] },
    selected: { initial: null as string | null },
    editing: { initial: null as string | null },
  },
  events: {
    selected: { payload: t<{ id: string; data?: unknown }>() },
    activated: { payload: t<{ id: string; data?: unknown }>() },
    expanded: { payload: t<{ id: string }>() },
    collapsed: { payload: t<{ id: string }>() },
    contextmenu: { payload: t<{ id: string; x: number; y: number; data?: unknown }>() },
    renamed: { payload: t<{ id: string; name: string }>() },
  },
  ops: (at) => ({
    setNodes: at("nodes").op("set"),
    setSelected: at("selected").op("set"),
    select: at("selected").op("set"),
    rename: at("editing").op("set"),
  }),
  methods: (self) => ({
    nodes: () => self.at("nodes").get(),
    selection: () => self.at("selected").get(),
    expand: async (id: string) => {
      const cur = await self.at("expanded").get();
      if (!cur.includes(id)) self.at("expanded").append(id);
    },
    collapse: async (id: string) => {
      const cur = await self.at("expanded").get();
      const i = cur.indexOf(id);
      if (i >= 0) self.at("expanded").removeAt(i);
    },
    setChildren: async (id: string, children: TreeNode[]) => {
      const cur = await self.at("nodes").get();
      self.at("nodes").set(mapNode(cur, id, (n) => ({ ...n, children })));
    },
  }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const tree = (opts: TreeOptions | TreeNode[] = {}) => treeDef(Array.isArray(opts) ? { nodes: opts } : opts);
