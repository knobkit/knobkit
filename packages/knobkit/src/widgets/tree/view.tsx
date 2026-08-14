import "./tree.css";
import { useState, useCallback } from "react";
import type { ViewProps } from "@knobkit/core/client";
import type { TreeNode } from "./def.js";

function TreeNodeView({
  node,
  depth,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected?: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selected === node.id;

  return (
    <>
      <div
        className={`pu-tree-node${isSelected ? " pu-tree-node--selected" : ""}`}
        style={{ paddingLeft: depth * 16 }}
        onClick={() => onSelect(node)}
      >
        <span
          className={`pu-tree-toggle${hasChildren ? "" : " pu-tree-toggle--leaf"}`}
          onClick={(e) => {
            if (hasChildren) {
              e.stopPropagation();
              onToggle(node.id);
            }
          }}
        >
          {hasChildren ? (isExpanded ? "▼" : "▶") : ""}
        </span>
        {node.icon && <span className="pu-tree-icon">{node.icon}</span>}
        <span className="pu-tree-label">{node.label}</span>
      </div>
      {hasChildren && isExpanded && (
        <div className="pu-tree-children">
          {node.children!.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              selected={selected}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function TreeView({ state, emit }: ViewProps<{ nodes: TreeNode[] }>) {
  const nodes = state.nodes ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // selection highlight is presentation-only, so plain component state (widget state is just `nodes`)
  const [selected, setSelected] = useState<string>();

  const onToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSelect = useCallback(
    (node: TreeNode) => {
      setSelected(node.id);
      emit("selected", { id: node.id, data: node.data });
    },
    [emit],
  );

  return (
    <div className="pu-tree">
      {nodes.map((node) => (
        <TreeNodeView
          key={node.id}
          node={node}
          depth={0}
          selected={selected}
          expanded={expanded}
          onToggle={onToggle}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
