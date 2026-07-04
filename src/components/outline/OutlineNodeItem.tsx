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
    <div>
      <div
        draggable onDragStart={e => onDragStart(e, node.id)} onDragOver={onDragOver} onDrop={e => { e.preventDefault(); onDrop(e, node.id); }}
        onClick={() => onSelect(node.id)}
        className="flex items-center group"
        style={{
          marginLeft: depth * 16,
          padding: "5px 10px",
          marginBottom: 1,
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
          background: isSelected ? "var(--brand-subtle)" : "transparent",
          boxShadow: isSelected ? "0 0 0 1px var(--brand-glow)" : "none",
          border: "1px solid transparent",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--border-default)"; } }}
        onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
      >
        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 10, flexShrink: 0, borderRadius: 4, transition: "color 0.15s ease" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text-secondary)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-tertiary)"}>
          {hasChildren ? (expanded ? "▾" : "▸") : "◦"}
        </button>

        <span style={{
          fontSize: 10, padding: "2px 6px", borderRadius: "var(--radius-xs)", flexShrink: 0, marginLeft: 6,
          background: "var(--bg-subtle)", color: "var(--text-tertiary)", fontWeight: 500, letterSpacing: "0.02em",
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

        <div className="hidden group-hover:flex items-center gap-[2px] shrink-0 ml-1">
          {allowedChildTypes.length > 0 && (
            <button onClick={e => { e.stopPropagation(); setShowAdd(!showAdd); }}
              style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "var(--text-tertiary)", borderRadius: "var(--radius-xs)", cursor: "pointer", transition: "all 0.15s ease", background: "transparent", border: "none" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--brand)"; e.currentTarget.style.background = "var(--brand-subtle)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}>
              +
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); if (confirm("Delete this node?")) onDelete(node.id); }}
            style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-tertiary)", borderRadius: "var(--radius-xs)", cursor: "pointer", transition: "all 0.15s ease", background: "transparent", border: "none" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text-tertiary)"; e.currentTarget.style.background = "transparent"; }}>
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
