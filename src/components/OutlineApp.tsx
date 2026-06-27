"use client";

import { useEffect, useCallback, useState } from "react";
import { useOutlineTree } from "@/hooks/useOutlineTree";
import OutlineTree from "@/components/outline/OutlineTree";
import ContentEditor from "@/components/outline/ContentEditor";
import ProjectTitleBar from "@/components/outline/ProjectTitleBar";
import { flattenTree } from "@/lib/outline-utils";
import { signOut } from "next-auth/react";
import { updateProjectLang } from "@/app/actions/project";
import ExportDialog from "@/components/export/ExportDialog";

interface OutlineAppProps {
  projectId: string;
  title: string;
  subtitle: string | null;
  keywords: string | null;
  titlePage: string | null;
  lang: string;
  hasApiKey: boolean;
}

export default function OutlineApp({ projectId, title, subtitle, keywords, titlePage, lang, hasApiKey }: OutlineAppProps) {
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

  const [showExportDialog, setShowExportDialog] = useState(false);
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

  const sidebarW = "w-[288px]";

  return (
    <div className="flex h-screen max-w-[1440px] mx-auto px-[24px]" style={{ background: "var(--bg-root)" }}>
      {/* Left: Outline sidebar */}
      <div className={`${sidebarW} shrink-0 flex flex-col border-r`} style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}>
        <ProjectTitleBar projectId={projectId} title={title} subtitle={subtitle} />

        {/* Toolbar */}
        <div className="flex items-center justify-between px-[16px] py-[8px] border-b" style={{ borderColor: "var(--border-default)" }}>
          <span className="heading-xs" style={{ color: "var(--text-secondary)" }}>Outline</span>
          <div className="flex items-center gap-[8px]">
            <button
              onClick={async () => { const nl = currentLang === "zh" ? "en" : "zh"; setCurrentLang(nl); await updateProjectLang(projectId, nl); }}
              className="btn btn-ghost" style={{ height: 32, padding: "0 8px", fontSize: 12 }}
            >
              {currentLang === "zh" ? "中" : "EN"}
            </button>
            <button onClick={() => setShowExportDialog(true)} className="btn btn-primary" style={{ height: 32, fontSize: 12, padding: "0 12px" }}>
              Export
            </button>
            <button onClick={() => signOut({ callbackUrl: "/auth/login" })} className="btn btn-ghost" style={{ height: 32, fontSize: 12, padding: "0 8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>

        {/* Outline tree */}
        <div className="flex-1 overflow-y-auto px-[8px] py-[8px]">
          {state.loading ? (
            <div className="text-center" style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 14 }}>Loading...</div>
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
      </div>

      {/* Right: Editor */}
      <div className="flex-1 min-w-0 min-h-0">
        <ContentEditor node={selectedNode} onUpdate={handleUpdate} onReload={loadTree} hasApiKey={hasApiKey} lang={currentLang} />
      </div>

      {showExportDialog && (
        <ExportDialog
          projectId={projectId} title={title} keywords={keywords} titlePage={titlePage}
          isEnglish={currentLang === "en"} onClose={() => setShowExportDialog(false)}
        />
      )}
    </div>
  );
}
