import { event } from "../event.js";
import { bound } from "../bound.js";
import { controls } from "../controls.js";
import type { EventCtor, Widget } from "../types.js";

export interface TreeNode {
  id: string;
  label: string;
  icon?: string;
  children?: TreeNode[];
  data?: unknown;
}

export interface TreeState {
  nodes: TreeNode[];
  selected?: string;
}

export interface TreeWidget extends Widget<TreeState> {
  selected: EventCtor<{ id: string; data?: unknown }>;
  setNodes(nodes: TreeNode[]): void;
  setSelected(id: string): void;
}

export function tree(nodes: TreeNode[] = []): TreeWidget {
  return {
    type: "tree",
    state: { nodes, selected: undefined },
    selected: event<{ id: string; data?: unknown }>("tree.selected"),
    ...controls,
    setNodes(nodes: TreeNode[]): void {
      bound(this).edit(this, "set", ["nodes"], nodes);
    },
    setSelected(id: string): void {
      bound(this).edit(this, "set", ["selected"], id);
    },
  };
}
