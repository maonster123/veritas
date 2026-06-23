"use client";

import { useState } from "react";
import { updateProject } from "@/app/actions/project";
import { generateKeywords } from "@/app/actions/ai-generate";

interface Props {
  projectId: string;
  title: string;
  subtitle: string | null;
  keywords: string | null;
}

export default function ProjectTitleBar({ projectId, title, subtitle, keywords }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [subtitleDraft, setSubtitleDraft] = useState(subtitle ?? "");
  const [localKeywords, setLocalKeywords] = useState(keywords ?? "");
  const [loadingKw, setLoadingKw] = useState(false);

  const saveTitle = async () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== title) {
      await updateProject(projectId, { title: trimmed });
    }
    setEditingTitle(false);
  };

  const saveSubtitle = async () => {
    const trimmed = subtitleDraft.trim();
    if (trimmed !== (subtitle ?? "")) {
      await updateProject(projectId, { subtitle: trimmed || undefined });
    }
    setEditingSubtitle(false);
  };

  return (
    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 space-y-2">
      {/* Title */}
      {editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") setEditingTitle(false);
          }}
          className="w-full text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-200"
        />
      ) : (
        <h1
          className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer hover:text-blue-600 transition-colors py-1.5"
          onClick={() => setEditingTitle(true)}
        >
          {title || "未命名论文"}
        </h1>
      )}

      {/* Subtitle */}
      {editingSubtitle ? (
        <div className="flex gap-1">
          <input
            autoFocus
            value={subtitleDraft}
            onChange={(e) => setSubtitleDraft(e.target.value)}
            onBlur={saveSubtitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveSubtitle();
              if (e.key === "Escape") { setEditingSubtitle(false); setSubtitleDraft(subtitle ?? ""); }
            }}
            placeholder="添加副标题..."
            className="w-full text-xs text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400"
          />
          {subtitle && (
            <button
              onMouseDown={() => {
                setSubtitleDraft("");
                updateProject(projectId, { subtitle: undefined });
                setEditingSubtitle(false);
              }}
              className="text-xs text-zinc-400 hover:text-red-500 shrink-0"
            >
              ×
            </button>
          )}
        </div>
      ) : subtitle ? (
        <p
          className="text-xs text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => { setEditingSubtitle(true); setSubtitleDraft(subtitle); }}
        >
          {subtitle}
        </p>
      ) : (
        <p
          className="text-xs text-zinc-400 cursor-pointer hover:text-blue-600 transition-colors"
          onClick={() => setEditingSubtitle(true)}
        >
          添加副标题...
        </p>
      )}

      {/* Keywords */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            value={localKeywords}
            onChange={(e) => setLocalKeywords(e.target.value)}
            onBlur={() => updateProject(projectId, { keywords: localKeywords || null })}
            placeholder="关键词（逗号分隔）"
            className="flex-1 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-400"
          />
          <button
            onClick={async () => {
              setLoadingKw(true);
              const r = await generateKeywords(projectId);
              if (r.success && r.keywords) setLocalKeywords(r.keywords);
              setLoadingKw(false);
            }}
            disabled={loadingKw}
            className="shrink-0 text-[10px] px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loadingKw ? "..." : "AI生成"}
          </button>
        </div>
      </div>
    </div>
  );
}
