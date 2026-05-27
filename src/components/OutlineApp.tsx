"use client";

import { useEffect, useCallback, useState } from "react";
import { useOutlineTree } from "@/hooks/useOutlineTree";
import OutlineTree from "@/components/outline/OutlineTree";
import ContentEditor from "@/components/outline/ContentEditor";
import { flattenTree } from "@/lib/outline-utils";
import { signOut } from "next-auth/react";

interface OutlineAppProps {
  projectId: string;
}

export default function OutlineApp({ projectId }: OutlineAppProps) {
  const { state, dispatch, loadTree, select, handleAdd, handleUpdate, handleDelete, handleMove } =
    useOutlineTree(projectId);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const selectedNode = state.selectedId
    ? flattenTree(state.tree).find((n) => n.id === state.selectedId) ?? null
    : null;

  const [showExport, setShowExport] = useState(false);

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
        <div className="sticky top-0 z-10 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            论文大纲
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                导出
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg z-20 py-1 min-w-[140px]">
                  <a
                    href={`/api/export/docx?projectId=${projectId}`}
                    className="block px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Word (.docx)
                  </a>
                  <a
                    href={`/export?projectId=${projectId}`}
                    target="_blank"
                    className="block px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    打印 PDF
                  </a>
                </div>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="text-xs px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              退出
            </button>
          </div>
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
