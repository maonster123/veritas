"use client";

import { useEffect, useCallback } from "react";
import { useOutlineTree } from "@/hooks/useOutlineTree";
import OutlineTree from "@/components/outline/OutlineTree";
import ContentEditor from "@/components/outline/ContentEditor";
import { flattenTree } from "@/lib/outline-utils";

const PROJECT_ID = "7a31d02c-309c-4e79-a286-affc2ce05387";

export default function Home() {
  const { state, dispatch, loadTree, select, handleAdd, handleUpdate, handleDelete, handleMove } =
    useOutlineTree(PROJECT_ID);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const selectedNode = state.selectedId
    ? flattenTree(state.tree).find((n) => n.id === state.selectedId) ?? null
    : null;

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData("text/plain");
      if (dragId && dragId !== targetId) {
        handleMove(dragId, targetId, 0);
      }
    },
    [handleMove]
  );

  return (
    <div className="flex flex-1 h-screen">
      {/* Left: Outline tree */}
      <div className="w-80 shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          <h1 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            论文大纲
          </h1>
        </div>
        {state.loading ? (
          <div className="p-4 text-sm text-zinc-400">加载中...</div>
        ) : (
          <OutlineTree
            tree={state.tree}
            selectedId={state.selectedId}
            onSelect={(id) => dispatch({ type: "SELECT", id })}
            onDelete={handleDelete}
            onUpdate={(id, data) => handleUpdate(id, data)}
            onAdd={(parentId, title, type) => handleAdd(parentId, title, type)}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        )}
      </div>

      {/* Right: Content editor */}
      <div className="flex-1 overflow-y-auto">
        <ContentEditor node={selectedNode} onUpdate={handleUpdate} />
      </div>
    </div>
  );
}
