import "./tree.css";
import { useRef, type MouseEvent, type ReactNode } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { TreeNode } from "./def.js";

interface TreeState {
  nodes: TreeNode[];
  expanded: string[];
  selected: string | null;
  editing: string | null;
}

function RenameInput({ value, onCommit, onCancel }: { value: string; onCommit: (v: string) => void; onCancel: () => void }) {
  const done = useRef(false);
  const finish = (commit: boolean, v: string) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(v);
    else onCancel();
  };
  return (
    <input
      className="pu-tree-input"
      defaultValue={value}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true, e.currentTarget.value);
        else if (e.key === "Escape") finish(false, "");
      }}
      onBlur={(e) => finish(true, e.currentTarget.value)}
    />
  );
}

export default function TreeView({ state, emit, set }: ViewProps<TreeState>) {
  const expanded = new Set(state.expanded ?? []);
  const selected = state.selected ?? null;
  const editing = state.editing ?? null;

  const toggle = (id: string) => {
    const open = expanded.has(id);
    const next = open ? (state.expanded ?? []).filter((x) => x !== id) : [...(state.expanded ?? []), id];
    set(["expanded"], next);
    emit(open ? "collapsed" : "expanded", { id });
  };
  const choose = (node: TreeNode) => {
    set(["selected"], node.id);
    emit("selected", { id: node.id, data: node.data });
  };
  const contextmenu = (node: TreeNode, e: MouseEvent) => {
    e.preventDefault();
    set(["selected"], node.id);
    emit("contextmenu", { id: node.id, x: e.clientX, y: e.clientY, data: node.data });
  };
  const commitRename = (id: string, value: string) => {
    set(["editing"], null);
    const name = value.trim();
    if (name) emit("renamed", { id, name });
  };

  const renderNode = (node: TreeNode, depth: number): ReactNode => {
    const folder = node.children !== undefined || node.hasChildren === true;
    const open = expanded.has(node.id);
    const kids = open && node.children && node.children.length > 0 ? node.children : null;
    return (
      <li key={node.id} role="treeitem" aria-expanded={folder ? open : undefined} aria-selected={node.id === selected}>
        <div
          className={`pu-tree-node${node.id === selected ? " pu-tree-node--selected" : ""}`}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() => choose(node)}
          onDoubleClick={() => emit("activated", { id: node.id, data: node.data })}
          onContextMenu={(e) => contextmenu(node, e)}
        >
          <span
            className={`pu-tree-toggle${folder ? "" : " pu-tree-toggle--leaf"}`}
            onClick={(e) => {
              if (folder) {
                e.stopPropagation();
                toggle(node.id);
              }
            }}
          >
            {folder ? (open ? "▼" : "▶") : ""}
          </span>
          {node.icon && <span className="pu-tree-icon">{node.icon}</span>}
          {node.id === editing ? (
            <RenameInput value={node.label} onCommit={(v) => commitRename(node.id, v)} onCancel={() => set(["editing"], null)} />
          ) : (
            <span className="pu-tree-label">{node.label}</span>
          )}
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
