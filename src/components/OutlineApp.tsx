"use client";

import { useEffect, useCallback, useState } from "react";
import { useOutlineTree } from "@/hooks/useOutlineTree";
import OutlineTree from "@/components/outline/OutlineTree";
import ContentEditor from "@/components/outline/ContentEditor";
import ProjectTitleBar from "@/components/outline/ProjectTitleBar";
import { flattenTree } from "@/lib/outline-utils";
import { signOut } from "next-auth/react";
import { updateProjectLang } from "@/app/actions/project";

interface OutlineAppProps {
  projectId: string;
  title: string;
  subtitle: string | null;
  keywords: string | null;
  lang: string;
  hasApiKey: boolean;
}

export default function OutlineApp({ projectId, title, subtitle, keywords, lang, hasApiKey }: OutlineAppProps) {
  const { state, dispatch, loadTree, select, handleAdd, handleUpdate, handleDelete, handleMove } =
    useOutlineTree(projectId);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  const selectedNode = state.selectedId
    ? flattenTree(state.tree).find((n) => n.id === state.selectedId) ?? null
    : null;

  const [showExport, setShowExport] = useState(false);
  const [currentLang, setCurrentLang] = useState(lang);

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
      <div className="w-96 shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        <ProjectTitleBar projectId={projectId} title={title} subtitle={subtitle} keywords={keywords} />
        <div className="sticky top-0 z-10 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">大纲</span>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const nextLang = currentLang === "zh" ? "en" : "zh";
                setCurrentLang(nextLang);
                await updateProjectLang(projectId, nextLang);
              }}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                currentLang === "zh"
                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
              }`}
              title={currentLang === "zh" ? "中文论文模式" : "English thesis mode"}
            >
              {currentLang === "zh" ? "中" : "EN"}
            </button>
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                导出
              </button>
              {showExport && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded shadow-lg z-20 py-1 min-w-[160px]">
                  <a
                    href={`/api/export/docx?projectId=${projectId}`}
                    onClick={() => setTimeout(() => setShowExport(false), 500)}
                    className="block px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Word (.docx) → 桌面
                  </a>
                  <button
                    onClick={async () => {
                      setShowExport(false);
                      await fetch(`/api/export/save-pdf?projectId=${projectId}`);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    网页 (.html) → 桌面
                  </button>
                  <a
                    href={`/export?projectId=${projectId}`}
                    target="_blank"
                    onClick={() => setTimeout(() => setShowExport(false), 500)}
                    className="block px-4 py-2 text-xs text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    打印预览
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

      {/* Right: Content editor + aux panel */}
      <div className="flex-1 min-w-0 min-h-0">
        <ContentEditor node={selectedNode} onUpdate={handleUpdate} onReload={loadTree} hasApiKey={hasApiKey} lang={currentLang} />
      </div>
    </div>
  );
}
