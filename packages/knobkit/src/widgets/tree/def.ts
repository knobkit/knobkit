import { defineWidget, t, viewRef } from "@knobkit/core";

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  data?: unknown;
}

const treeDef = defineWidget({
  type: "tree",
  state: { nodes: { initial: [] as TreeNode[] } },
  events: { selected: { payload: t<{ id: string; data?: unknown }>() } },
  ops: (at) => ({ setNodes: at("nodes").op("set") }),
  view: viewRef(import.meta.url, "./view.js"),
});

export const tree = (nodes: TreeNode[] = []) => treeDef({ nodes });
