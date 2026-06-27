"use client";

import { useState } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { nodeTypeLabel } from "@/lib/outline-utils";
import AddNodeForm from "./AddNodeForm";

interface Props {
  node: FlatNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string }) => void;
  onAdd: (parentId: string, title: string, type: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

const TYPE_HIERARCHY: Record<string, string[]> = {
  chapter: ["section"], section: ["subsection", "paragraph"], subsection: ["paragraph"], paragraph: [],
};

const TYPE_LABELS: Record<string, string> = {
  section: "Section", subsection: "Sub", paragraph: "Para",
};

export default function OutlineNodeItem({ node, depth, selectedId, onSelect, onDelete, onUpdate, onAdd, onDragStart, onDragOver, onDrop }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [showAdd, setShowAdd] = useState(false);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const allowedChildTypes = TYPE_HIERARCHY[node.type] ?? [];
  const handleTitleSave = () => { if (title.trim() && title !== node.title) onUpdate(node.id, { title: title.trim() }); setEditTitle(false); };

  return (
    <div style={{ marginBottom: 2 }}>
      <div
        draggable onDragStart={e => onDragStart(e, node.id)} onDragOver={onDragOver} onDrop={e => { e.preventDefault(); onDrop(e, node.id); }}
        onClick={() => onSelect(node.id)}
        className="flex items-center group"
        style={{
          marginLeft: depth * 16,
          padding: "8px 8px",
          borderRadius: 6,
          cursor: "grab",
          background: isSelected ? "var(--brand-subtle)" : "transparent",
          border: isSelected ? "1px solid var(--brand)" : "1px solid transparent",
          transition: "all 0.1s ease",
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
      >
        {/* Drag handle */}
        <span
          style={{ width: 16, height: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 10, flexShrink: 0, cursor: "grab", marginRight: 2 }}
          title="拖拽排序"
          onMouseDown={e => e.stopPropagation()}
        >
          ⋮⋮
        </span>
        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 10, flexShrink: 0 }}>
          {hasChildren ? (expanded ? "▾" : "▸") : "◦"}
        </button>

        <span style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 4, flexShrink: 0, marginLeft: 6,
          background: "var(--bg-subtle)", color: "var(--text-tertiary)",
        }}>
          {nodeTypeLabel(node.type)}
        </span>

        {editTitle ? (
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleSave} onKeyDown={e => { if (e.key === "Enter") handleTitleSave(); if (e.key === "Escape") setEditTitle(false); }}
            onClick={e => e.stopPropagation()}
            className="input-field" style={{ flex: 1, marginLeft: 8, height: 28, fontSize: 14 }} />
        ) : (
          <span style={{ flex: 1, marginLeft: 8, fontSize: 14, color: isSelected ? "var(--brand)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            onDoubleClick={() => setEditTitle(true)}>
            {node.title}
          </span>
        )}

        <div style={{ display: "none", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 4 }} className="group-hover:flex">
          {allowedChildTypes.length > 0 && (
            <button onClick={e => { e.stopPropagation(); setShowAdd(!showAdd); }}
              style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-tertiary)", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--brand)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>
              +
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); if (confirm("Delete this node?")) onDelete(node.id); }}
            style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-tertiary)", borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>
            ×
          </button>
        </div>
      </div>

      {showAdd && allowedChildTypes.length > 0 && (
        <div style={{ marginLeft: (depth + 1) * 16 + 8, marginBottom: 4 }}>
          <AddNodeForm onAdd={(title, type) => { onAdd(node.id, title, type); setShowAdd(false); }}
            onCancel={() => setShowAdd(false)} types={allowedChildTypes} typeLabels={TYPE_LABELS} />
        </div>
      )}

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <OutlineNodeItem key={child.id} node={child} depth={depth + 1} selectedId={selectedId}
              onSelect={onSelect} onDelete={onDelete} onUpdate={onUpdate} onAdd={onAdd}
              onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} />
          ))}
        </div>
      )}
    </div>
  );
}
