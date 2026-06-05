"use client";

import { useEffect, useRef } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { useChat } from "@/hooks/useChat";

interface Props {
  node: FlatNode | null;
}

export default function ChatPanel({ node }: Props) {
  const { messages, isLoading, error, send, loadHistory, setError } = useChat(node?.id ?? null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load history when node changes
  useEffect(() => {
    if (node?.id) {
      loadHistory(node.id);
    }
  }, [node?.id, loadHistory]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const content = inputRef.current?.value ?? "";
    if (!content.trim() || isLoading || !node?.id) return;
    send(node.id, content);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Empty state
  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        选择一个大纲节点开始对话
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
          {node.title}
        </h2>
        <p className="text-[10px] text-zinc-400 mt-0.5">AI 写作助手</p>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-zinc-400 text-sm mt-8">
            向 AI 提问以开始协作写作
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 shrink-0">
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded px-3 py-2 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送)"
            disabled={isLoading}
            className="flex-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 placeholder:text-zinc-400"
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="text-xs px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
