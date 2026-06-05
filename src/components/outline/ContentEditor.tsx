"use client";

import { useState, useEffect, useRef } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { generateAIContent, recommendResources, saveDeepseekKey } from "@/app/actions/ai-generate";
import { sendMessage, getChatHistory } from "@/app/actions/chat";

interface Props {
  node: FlatNode | null;
  onUpdate: (id: string, data: { content?: string; notes?: string }) => void;
  hasApiKey: boolean;
}

type AuxTab = "notes" | "ai" | "resources" | "chat";

export default function ContentEditor({ node, onUpdate, hasApiKey }: Props) {
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState("");
  const [activeAux, setActiveAux] = useState<AuxTab>("notes");

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
    <div className="h-full grid grid-cols-[360px_1fr] min-h-0">
      {/* ── Left: Auxiliary panel (tabs) ── */}
      <div className="border-r border-zinc-200 dark:border-zinc-800 flex flex-col min-h-0">
        {/* Node header */}
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
            {node.title}
          </h2>
          {node.outlineReferences && node.outlineReferences.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {node.outlineReferences.map((or) => (
                <span key={or.id} className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                  {or.citationText || `[${or.reference.title}]`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Aux tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <AuxTabButton active={activeAux === "notes"} onClick={() => setActiveAux("notes")}>备注</AuxTabButton>
          <AuxTabButton active={activeAux === "ai"} onClick={() => setActiveAux("ai")}>AI推荐</AuxTabButton>
          <AuxTabButton active={activeAux === "resources"} onClick={() => setActiveAux("resources")}>文献推荐</AuxTabButton>
          <AuxTabButton active={activeAux === "chat"} onClick={() => setActiveAux("chat")}>AI助手</AuxTabButton>
        </div>

        {/* Aux content */}
        <div className="flex-1 p-4">
          {activeAux === "notes" ? (
            <NotesPanel notes={notes} setNotes={setNotes} saveNotes={() => onUpdate(node.id, { notes })} />
          ) : activeAux === "ai" ? (
            <AITab node={node} hasApiKey={hasApiKey} />
          ) : activeAux === "resources" ? (
            <ResourcesTab node={node} hasApiKey={hasApiKey} />
          ) : (
            <ChatTab node={node} hasApiKey={hasApiKey} />
          )}
        </div>
      </div>

      {/* ── Right: Content (always visible) ── */}
      <div className="flex flex-col min-h-0 min-w-0">
        <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">正文</span>
          <span className="text-[10px] text-zinc-400">支持 Markdown</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={saveContent}
          placeholder="在此撰写正文..."
          className="flex-1 w-full bg-transparent text-sm text-zinc-800 dark:text-zinc-200 resize-none focus:outline-none placeholder:text-zinc-400 p-4"
        />
      </div>
    </div>
  );
}

function AuxTabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
        active
          ? "border-b-2 border-blue-600 text-blue-600"
          : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}

// ── Notes Panel ──

function NotesPanel({ notes, setNotes, saveNotes }: { notes: string; setNotes: (v: string) => void; saveNotes: () => void }) {
  return (
    <textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      onBlur={saveNotes}
      placeholder="个人备注（不会输出到最终文档）..."
      className="w-full min-h-[300px] bg-transparent text-sm text-zinc-500 dark:text-zinc-400 resize-none focus:outline-none placeholder:text-zinc-400 italic"
    />
  );
}

// ── AI Content Generation ──

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
    setLoading(true); setError("");
    try {
      const result = await generateAIContent(node.id);
      if (result.success && result.content) { setAiContent(result.content); setNeedsKey(false); }
      else if (result.error === "MISSING_KEY") setNeedsKey(true);
      else setError(result.error ?? "生成失败");
    } catch (e) { setError(e instanceof Error ? e.message : "生成失败"); }
    setLoading(false);
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setLoading(true); setError("");
    const r = await saveDeepseekKey(apiKey.trim());
    if (r.success) { setNeedsKey(false); setApiKey(""); handleGenerate(); }
    else setError(r.error ?? "保存失败");
    setLoading(false);
  };

  if (needsKey === true) return <KeyInputForm apiKey={apiKey} setApiKey={setApiKey} onSave={handleSaveKey} loading={loading} error={error} />;

  return (
    <div className="flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handleGenerate} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
          {loading ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />生成中...</> : "生成推荐内容"}
        </button>
        <span className="text-[10px] text-zinc-400">仅供参考，请核实</span>
      </div>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      {aiContent ? (
        <div className="relative">
          <div ref={contentRef} onMouseUp={() => { const s = window.getSelection(); if (s?.toString()) { navigator.clipboard.writeText(s.toString()); setCopied(true); setTimeout(() => setCopied(false), 1500); } }} className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed select-text">{aiContent}</div>
          {copied && <div className="absolute top-0 right-0 text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">已复制</div>}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1 text-zinc-400 text-sm">点击生成获取 AI 写作建议</div>
      )}
    </div>
  );
}

// ── Resource Recommendation ──

interface ResourceItem { name: string; url: string; description: string; needsVpn: boolean; citation: string; }

function ResourcesTab({ node, hasApiKey }: { node: FlatNode; hasApiKey: boolean }) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [needsKey, setNeedsKey] = useState(!hasApiKey);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => { setResources([]); setError(""); setHasLoaded(false); }, [node.id]);

  const handleRecommend = async () => {
    setLoading(true); setError("");
    try {
      const r = await recommendResources(node.id);
      if (r.success && r.resources) { setResources(r.resources); setNeedsKey(false); setHasLoaded(true); }
      else if (r.error === "MISSING_KEY") setNeedsKey(true);
      else setError(r.error ?? "推荐失败");
    } catch (e) { setError(e instanceof Error ? e.message : "推荐失败"); }
    setLoading(false);
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setLoading(true); setError("");
    const r = await saveDeepseekKey(apiKey.trim());
    if (r.success) { setNeedsKey(false); setApiKey(""); handleRecommend(); }
    else setError(r.error ?? "保存失败");
    setLoading(false);
  };

  if (needsKey === true) return <KeyInputForm apiKey={apiKey} setApiKey={setApiKey} onSave={handleSaveKey} loading={loading} error={error} />;

  return (
    <div className="flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handleRecommend} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
          {loading ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />搜索中...</> : "推荐文献资源"}
        </button>
        <span className="text-[10px] text-zinc-400">网址来自训练数据</span>
      </div>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      {resources.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-emerald-400 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 truncate">{r.name}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{r.description}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 truncate">{r.url}</p>
                  {r.citation && (
                    <p className="text-[10px] text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 italic leading-relaxed">
                      {r.citation}
                    </p>
                  )}
                </div>
                {r.needsVpn && <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded">⚠ 需VPN</span>}
              </div>
            </a>
          ))}
        </div>
      )}
      {!hasLoaded && !error && <div className="flex items-center justify-center flex-1 text-zinc-400 text-sm">点击按钮获取相关学术网站</div>}
      {hasLoaded && resources.length === 0 && !error && <div className="flex items-center justify-center flex-1 text-zinc-400 text-sm">未找到相关资源</div>}
    </div>
  );
}

// ── Chat Tab ──

function ChatTab({ node, hasApiKey }: { node: FlatNode; hasApiKey: boolean }) {
  const [messages, setMessages] = useState<{ id: string; role: string; content: string; createdAt: Date }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [needsKey, setNeedsKey] = useState(!hasApiKey);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<string>("");

  useEffect(() => {
    nodeRef.current = node.id;
    setError("");
    if (hasApiKey) {
      getChatHistory(node.id).then(r => { if (r.success && nodeRef.current === node.id) setMessages(r.messages ?? []); });
    }
  }, [node.id, hasApiKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const content = input.trim();
    setInput("");
    setError("");

    const userMsg = { id: `temp-${Date.now()}`, role: "user", content, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    const r = await sendMessage(node.id, content);
    if (nodeRef.current !== node.id) return;

    if (r.success && r.reply) {
      setMessages(prev => {
        const clean = prev.filter(m => m.id !== userMsg.id);
        return [...clean, { id: `usr-${Date.now()}`, role: "user", content, createdAt: new Date() }, { id: `ai-${Date.now()}`, role: "assistant", content: r.reply!, createdAt: new Date() }];
      });
    } else {
      setMessages(prev => prev.filter(m => m.id !== userMsg.id));
      if (r.error === "MISSING_KEY") setNeedsKey(true);
      else setError(r.error ?? "发送失败");
    }
    setIsLoading(false);
  };

  if (needsKey === true) return <KeyInputForm apiKey={apiKey} setApiKey={setApiKey} loading={isLoading} error={error} onSave={async () => {
    if (!apiKey.trim()) return;
    await saveDeepseekKey(apiKey.trim());
    setNeedsKey(false); setApiKey("");
  }} />;

  return (
    <div className="flex flex-col min-h-[350px]">
      <div className="space-y-3 mb-3" style={{ minHeight: "200px" }}>
        {messages.length === 0 && !isLoading && <div className="text-center text-zinc-400 text-sm mt-4">向 AI 提问开始协作</div>}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-3">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <div className="mb-2 text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded px-3 py-2 flex items-center justify-between"><span>{error}</span><button onClick={() => setError("")} className="text-red-400">&times;</button></div>}
      <div className="flex gap-2 shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="输入消息..." disabled={isLoading} className="flex-1 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 placeholder:text-zinc-400" />
        <button onClick={handleSend} disabled={isLoading} className="text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 shrink-0">发送</button>
      </div>
    </div>
  );
}

// ── Shared: API Key Input ──

function KeyInputForm({ apiKey, setApiKey, onSave, loading, error }: { apiKey: string; setApiKey: (v: string) => void; onSave: () => void; loading: boolean; error: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">请设置 DeepSeek API Key（<a href="https://platform.deepseek.com/api_keys" target="_blank" className="text-blue-600 underline">在此获取</a>）</p>
      <input autoFocus type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onSave(); }} placeholder="sk-..." className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <button onClick={onSave} disabled={loading} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{loading ? "保存中..." : "保存"}</button>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
