"use client";

import { useState, useEffect, useRef } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { generateAIContent, saveDeepseekKey } from "@/app/actions/ai-generate";

interface Props {
  node: FlatNode | null;
  onUpdate: (id: string, data: { content?: string; notes?: string }) => void;
  hasApiKey: boolean;
}

export default function ContentEditor({ node, onUpdate, hasApiKey }: Props) {
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"content" | "notes" | "ai">("content");

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
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>
          正文
        </TabButton>
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
          备注
        </TabButton>
        <TabButton active={tab === "ai"} onClick={() => setTab("ai")}>
          AI 推荐
        </TabButton>
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
        ) : tab === "notes" ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveContent}
            placeholder="个人备注（不会输出到最终文档）..."
            className="w-full h-full min-h-[300px] bg-transparent text-sm text-zinc-500 dark:text-zinc-400 resize-none focus:outline-none placeholder:text-zinc-400 italic"
          />
        ) : (
          <AITab node={node} hasApiKey={hasApiKey} />
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium ${
        active
          ? "border-b-2 border-blue-600 text-blue-600"
          : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

function AITab({ node, hasApiKey }: { node: FlatNode; hasApiKey: boolean }) {
  const [aiContent, setAiContent] = useState(node.aiContent ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [needsKey, setNeedsKey] = useState(!hasApiKey);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAiContent(node.aiContent ?? "");
    setError("");
  }, [node.id, node.aiContent]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await generateAIContent(node.id);
      if (result.success && result.content) {
        setAiContent(result.content);
        setNeedsKey(false);
      } else {
        if (result.error === "MISSING_KEY") {
          setNeedsKey(true);
        } else {
          setError(result.error ?? "生成失败");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    }
    setLoading(false);
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    const result = await saveDeepseekKey(apiKey.trim());
    if (result.success) {
      setNeedsKey(false);
      setApiKey("");
      // Auto-generate after saving key
      const genResult = await generateAIContent(node.id);
      if (genResult.success && genResult.content) {
        setAiContent(genResult.content);
      } else {
        setError(genResult.error ?? "生成失败");
      }
    } else {
      setError(result.error ?? "保存失败");
    }
    setLoading(false);
  };

  const handleCopy = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      navigator.clipboard.writeText(selection.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Show key input if we know they need one
  if (needsKey === true) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          请设置 DeepSeek API Key（<a href="https://platform.deepseek.com/api_keys" target="_blank" className="text-blue-600 underline">在此获取</a>）
        </p>
        <input
          autoFocus
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey(); }}
          placeholder="sk-..."
          className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveKey}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "保存中..." : "保存并生成"}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handleGenerate}
          disabled={loading || needsKey === null}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              生成中...
            </>
          ) : (
            "生成推荐内容"
          )}
        </button>
        <span className="text-[10px] text-zinc-400">AI 生成仅供参考，请核实后使用</span>
      </div>

      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

      {aiContent ? (
        <div className="relative flex-1">
          <div
            ref={contentRef}
            onMouseUp={handleCopy}
            className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed select-text"
          >
            {aiContent}
          </div>
          {copied && (
            <div className="absolute top-0 right-0 text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
              已复制
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 text-zinc-400 text-sm">
          点击"生成推荐内容"获取 AI 写作建议
        </div>
      )}
    </div>
  );
}
