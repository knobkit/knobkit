import "./tree.css";
import { useRef, type ReactNode } from "react";
import type { ViewProps } from "../../view.js";
import type { TreeWidget, TreeNode } from "../../../lib/widgets/tree.js";

type S = { nodes: TreeNode[]; expanded: string[]; selected: string | null; editing: string | null };

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

export function TreeView({ widget, state, emit, set }: ViewProps<TreeWidget, S>) {
  const expanded = new Set(state.expanded ?? []);
  const selected = state.selected ?? null;
  const editing = state.editing ?? null;

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
  const contextmenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    set(["selected"], id);
    emit(widget.contextmenu({ id, x: e.clientX, y: e.clientY }));
  };
  const commitRename = (id: string, value: string) => {
    set(["editing"], null);
    const name = value.trim();
    if (name) emit(widget.renamed({ id, name }));
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
          onContextMenu={(e) => contextmenu(node.id, e)}
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
