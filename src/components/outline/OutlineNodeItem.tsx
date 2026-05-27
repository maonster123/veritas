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
  chapter: ["section"],
  section: ["subsection", "paragraph"],
  subsection: ["paragraph"],
  paragraph: [],
};

const TYPE_LABELS: Record<string, string> = {
  section: "节",
  subsection: "小节",
  paragraph: "段",
};

export default function OutlineNodeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onUpdate,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [editTitle, setEditTitle] = useState(false);
  const [title, setTitle] = useState(node.title);
  const [showAdd, setShowAdd] = useState(false);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const allowedChildTypes = TYPE_HIERARCHY[node.type] ?? [];

  const handleTitleSave = () => {
    if (title.trim() && title !== node.title) {
      onUpdate(node.id, { title: title.trim() });
    }
    setEditTitle(false);
  };

  const indent = depth * 20;

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={onDragOver}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(e, node.id);
        }}
        onClick={() => onSelect(node.id)}
        className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-300 dark:ring-blue-700"
            : ""
        }`}
        style={{ marginLeft: indent }}
      >
        {/* Expand/Collapse */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600 shrink-0 text-xs"
        >
          {hasChildren ? (expanded ? "▾" : "▸") : "◦"}
        </button>

        {/* Type badge */}
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 shrink-0">
          {nodeTypeLabel(node.type)}
        </span>

        {/* Title */}
        {editTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleSave();
              if (e.key === "Escape") setEditTitle(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        ) : (
          <span
            className="flex-1 text-sm text-zinc-800 dark:text-zinc-200 truncate"
            onDoubleClick={() => setEditTitle(true)}
          >
            {node.title}
          </span>
        )}

        {/* Action buttons */}
        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
          {allowedChildTypes.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAdd(!showAdd);
              }}
              className="w-6 h-6 flex items-center justify-center text-xs text-zinc-400 hover:text-green-600 rounded"
              title="添加子节点"
            >
              +
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("确定删除此节点及其所有子节点？")) onDelete(node.id);
            }}
            className="w-6 h-6 flex items-center justify-center text-xs text-zinc-400 hover:text-red-600 rounded"
            title="删除"
          >
            ×
          </button>
        </div>
      </div>

      {/* Add child form */}
      {showAdd && allowedChildTypes.length > 0 && (
        <div style={{ marginLeft: indent + 24 }} className="mb-1">
          <AddNodeForm
            onAdd={(title, type) => {
              onAdd(node.id, title, type);
              setShowAdd(false);
            }}
            onCancel={() => setShowAdd(false)}
            types={allowedChildTypes}
            typeLabels={TYPE_LABELS}
          />
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <OutlineNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onAdd={onAdd}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
