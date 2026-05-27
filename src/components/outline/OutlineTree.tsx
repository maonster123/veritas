"use client";

import { useState } from "react";
import AddNodeForm from "./AddNodeForm";
import OutlineNodeItem from "./OutlineNodeItem";
import type { FlatNode } from "@/lib/outline-utils";

interface Props {
  tree: FlatNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string }) => void;
  onAdd: (parentId: string | null, title: string, type: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

export default function OutlineTree({
  tree,
  selectedId,
  onSelect,
  onDelete,
  onUpdate,
  onAdd,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const [showAddRoot, setShowAddRoot] = useState(false);

  return (
    <div className="py-2">
      {tree.map((node) => (
        <OutlineNodeItem
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAdd={(parentId, title, type) => onAdd(parentId, title, type)}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      ))}

      {showAddRoot ? (
        <div className="mt-2">
          <AddNodeForm
            onAdd={(title, type) => {
              onAdd(null, title, type);
              setShowAddRoot(false);
            }}
            onCancel={() => setShowAddRoot(false)}
            types={["chapter"]}
            typeLabels={{ chapter: "章" }}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAddRoot(true)}
          className="mt-2 ml-6 text-sm text-zinc-400 hover:text-blue-600 transition-colors"
        >
          + 添加章
        </button>
      )}
    </div>
  );
}
