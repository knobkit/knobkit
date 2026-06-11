import "./tree.css";
import type { ReactNode } from "react";
import type { ViewProps } from "../../view.js";
import type { TreeWidget, TreeNode } from "../../../lib/widgets/tree.js";

type S = { nodes: TreeNode[]; expanded: string[]; selected: string | null };

export function TreeView({ widget, state, emit, set }: ViewProps<TreeWidget, S>) {
  const expanded = new Set(state.expanded ?? []);
  const selected = state.selected ?? null;

  const toggle = (id: string) => {
    const open = expanded.has(id);
    const next = open ? (state.expanded ?? []).filter((x) => x !== id) : [...(state.expanded ?? []), id];
    set(["expanded"], next);
    emit(open ? widget.collapsed({ id }) : widget.expanded({ id }));
  };
  const choose = (id: string) => {
    set(["selected"], id);
    emit(widget.selected({ id }));
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const folder = node.children !== undefined || node.hasChildren === true;
    const open = expanded.has(node.id);
    const kids = open && node.children && node.children.length > 0 ? node.children : null;
    return (
      <li key={node.id} role="treeitem" aria-expanded={folder ? open : undefined} aria-selected={node.id === selected}>
        <div
          className={`pu-tree-row${node.id === selected ? " pu-tree-row-selected" : ""}`}
          style={{ paddingLeft: `calc(${depth} * var(--pu-gap) + var(--pu-cpad-x))` }}
          onClick={() => choose(node.id)}
          onDoubleClick={() => emit(widget.activated({ id: node.id }))}
        >
          <span
            className={`pu-tree-twist${folder ? "" : " pu-tree-twist-leaf"}`}
            onClick={(e) => {
              e.stopPropagation();
              if (folder) toggle(node.id);
            }}
          >
            {folder ? (open ? "▾" : "▸") : ""}
          </span>
          {node.icon ? <span className="pu-tree-icon">{node.icon}</span> : null}
          <span className="pu-tree-label">{node.label}</span>
        </div>
        {kids ? (
          <ul className="pu-tree-children" role="group">
            {kids.map((c) => renderNode(c, depth + 1))}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <ul className="pu-tree" role="tree">
      {(state.nodes ?? []).map((n) => renderNode(n, 0))}
    </ul>
  );
}
