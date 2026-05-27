"use client";

import { useState, useEffect } from "react";
import type { FlatNode } from "@/lib/outline-utils";

interface Props {
  node: FlatNode | null;
  onUpdate: (id: string, data: { content?: string; notes?: string }) => void;
}

export default function ContentEditor({ node, onUpdate }: Props) {
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"content" | "notes">("content");

  // Sync local state when selected node changes
  useEffect(() => {
    setContent(node?.content ?? "");
    setNotes(node?.notes ?? "");
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        选择一个大纲节点开始写作
      </div>
    );
  }

  const saveContent = () => {
    onUpdate(node.id, { content, notes });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Node info header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {node.title}
        </h2>
        {node.outlineReferences && node.outlineReferences.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {node.outlineReferences.map((or) => (
              <span
                key={or.id}
                className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded"
              >
                {or.citationText || `[${or.reference.title}]`}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setTab("content")}
          className={`px-4 py-2 text-xs font-medium ${
            tab === "content"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          正文
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`px-4 py-2 text-xs font-medium ${
            tab === "notes"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          备注
        </button>
      </div>

      {/* Editor area */}
      <div className="flex-1 p-4">
        {tab === "content" ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={saveContent}
            placeholder="在此撰写正文（支持 Markdown）..."
            className="w-full h-full min-h-[300px] bg-transparent text-sm text-zinc-800 dark:text-zinc-200 resize-none focus:outline-none placeholder:text-zinc-400"
          />
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveContent}
            placeholder="个人备注（不会输出到最终文档）..."
            className="w-full h-full min-h-[300px] bg-transparent text-sm text-zinc-500 dark:text-zinc-400 resize-none focus:outline-none placeholder:text-zinc-400 italic"
          />
        )}
      </div>
    </div>
  );
}
