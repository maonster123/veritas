"use client";

import { useState, useEffect, useRef } from "react";
import type { FlatNode } from "@/lib/outline-utils";
import { generateAIContent, recommendResources, normalizeCitation } from "@/app/actions/ai-generate";
import { sendMessage, getChatHistory } from "@/app/actions/chat";
import { unlinkReference, linkReference } from "@/app/actions/outline";
import { lookupAndSaveDOI, saveSimpleReference } from "@/app/actions/lookup-doi";

interface Props {
  node: FlatNode | null;
  onUpdate: (id: string, data: { content?: string; notes?: string }) => void;
  onReload: () => void;
  lang: string;
}

type AuxTab = "notes" | "ai" | "resources" | "chat" | "norm";

export default function ContentEditor({ node, onUpdate, onReload, lang }: Props) {
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
    <div className="h-full grid grid-cols-[400px_1fr] min-h-0">
      {/* ── Left: Auxiliary panel — glass ── */}
      <div className="flex flex-col min-h-0" style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(var(--glass-blur))",
        WebkitBackdropFilter: "blur(var(--glass-blur))",
        borderRight: "1px solid var(--glass-border)",
      }}>
        {/* Node header */}
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-default)", flexShrink: 0 }}>
          <h2 className="heading-sm truncate" style={{ color: "var(--text-primary)" }}>{node.title}</h2>
          {node.outlineReferences && node.outlineReferences.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {node.outlineReferences.map((or) => (
                <span key={or.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "var(--brand-subtle)", color: "var(--brand)", fontWeight: 500 }}>
                  {or.citationText || `[${or.reference.title}]`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Aux tabs */}
        <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border-default)", padding: "0 4px" }}>
          <AuxTabButton active={activeAux === "notes"} onClick={() => setActiveAux("notes")} color="notes" icon={<NotesIcon />}>{lang === "zh" ? "备注" : "Notes"}</AuxTabButton>
          <AuxTabButton active={activeAux === "ai"} onClick={() => setActiveAux("ai")} color="ai" icon={<AIIcon />}>{lang === "zh" ? "AI推荐" : "AI"}</AuxTabButton>
          <AuxTabButton active={activeAux === "resources"} onClick={() => setActiveAux("resources")} color="resources" icon={<ResourcesIcon />}>{lang === "zh" ? "文献推荐" : "Resources"}</AuxTabButton>
          <AuxTabButton active={activeAux === "chat"} onClick={() => setActiveAux("chat")} color="chat" icon={<ChatIcon />}>{lang === "zh" ? "AI助手" : "Chat"}</AuxTabButton>
          <AuxTabButton active={activeAux === "norm"} onClick={() => setActiveAux("norm")} color="cite" icon={<CiteIcon />}>{lang === "zh" ? "引用规范" : "Cite"}</AuxTabButton>
        </div>

        {/* Aux content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 16, wordBreak: "break-word", overflowWrap: "anywhere" }}>
          {activeAux === "notes" ? (
            <NotesPanel notes={notes} setNotes={setNotes} saveNotes={() => onUpdate(node.id, { notes })} />
          ) : activeAux === "ai" ? (
            <AITab node={node} />
          ) : activeAux === "resources" ? (
            <ResourcesTab node={node} />
          ) : activeAux === "norm" ? (
            <NormTab node={node} lang={lang} />
          ) : (
            <ChatTab node={node} />
          )}
        </div>
      </div>

      {/* ── Right: Content — warm surface ── */}
      <div className="flex flex-col min-h-0 min-w-0" style={{ background: "var(--bg-root)" }}>
        <div className="flex items-center justify-between shrink-0" style={{ padding: "10px 24px", borderBottom: "1px solid var(--border-default)" }}>
          <span className="heading-xs" style={{ color: "var(--text-secondary)" }}>{lang === "zh" ? "正文" : "Content"}</span>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 500, letterSpacing: "0.02em" }}>Markdown</span>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={saveContent}
            placeholder={lang === "zh" ? "开始写作..." : "Start writing..."}
            className="w-full min-h-[400px] resize-none"
            style={{ background: "transparent", border: "none", outline: "none", fontSize: 16, lineHeight: 1.75, color: "var(--text-primary)", fontFamily: "system-ui, sans-serif", height: "calc(100% - 48px)" }}
          />
        </div>
        <RefSection node={node} onReload={onReload} />
      </div>
    </div>
  );
}

function AuxTabButton({ active, onClick, children, color, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; color: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`tab-underline tab-${color}${active ? " active" : ""}`}>
      <span className={`tab-icon-badge tab-icon-${color}`}>
        {icon}
      </span>
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
      className="w-full min-h-[300px] resize-none"
      style={{ background: "transparent", border: "none", outline: "none", fontSize: 14, lineHeight: 1.75, color: "var(--text-secondary)", fontStyle: "italic" }}
    />
  );
}

// ── AI Content Generation ──

function AITab({ node }: { node: FlatNode }) {
  const [aiContent, setAiContent] = useState(node.aiContent ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      if (result.success && result.content) { setAiContent(result.content); }
      else setError(result.error ?? "生成失败");
    } catch (e) { setError(e instanceof Error ? e.message : "生成失败"); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handleGenerate} disabled={loading} className="btn" style={{ height: 32, fontSize: 12, padding: "0 12px", background: "linear-gradient(135deg, #c47da0, #8e4d6a)", color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(196,125,160,0.25)" }}>
          {loading ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />生成中...</> : "生成推荐内容"}
        </button>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>仅供参考，请核实</span>
      </div>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      {aiContent ? (
        <div className="relative animate-fade-in">
          <div ref={contentRef} onMouseUp={() => { const s = window.getSelection(); if (s?.toString()) { navigator.clipboard.writeText(s.toString()); setCopied(true); setTimeout(() => setCopied(false), 1500); } }} className="text-sm whitespace-pre-wrap select-text" style={{ lineHeight: 1.75, color: "var(--text-primary)" }}>{aiContent}</div>
          {copied && <div className="absolute top-0 right-0" style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-xs)", background: "var(--brand-subtle)", color: "var(--brand)" }}>已复制</div>}
        </div>
      ) : (
        <div className="flex items-center justify-center flex-1" style={{ fontSize: 14, color: "var(--text-tertiary)" }}>点击生成获取 AI 写作建议</div>
      )}
    </div>
  );
}

// ── Resource Recommendation ──

interface ResourceItem { name: string; url: string; description: string; needsVpn: boolean; citation: string; }

function ResourcesTab({ node }: { node: FlatNode }) {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => { setResources([]); setError(""); setHasLoaded(false); }, [node.id]);

  const handleRecommend = async () => {
    setLoading(true); setError("");
    try {
      const r = await recommendResources(node.id);
      if (r.success && r.resources) { setResources(r.resources); setHasLoaded(true); }
      else setError(r.error ?? "推荐失败");
    } catch (e) { setError(e instanceof Error ? e.message : "推荐失败"); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={handleRecommend} disabled={loading} className="btn" style={{ height: 32, fontSize: 12, padding: "0 12px", background: "linear-gradient(135deg, #5da88c, #3d7a64)", color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(77,155,130,0.25)" }}>
          {loading ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />搜索中...</> : "推荐文献资源"}
        </button>
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>网址来自训练数据</span>
      </div>
      {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
      {resources.length > 0 && (
        <div className="flex-1 space-y-2 overflow-y-auto" style={{ overflowX: "hidden", wordBreak: "break-word" }}>
          <div style={{ fontSize: 10, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", color: "var(--text-secondary)", textAlign: "center", border: "1px solid var(--border-default)" }}>
            ⚠ Some websites may require VPN to access from China
          </div>
          {resources.map((r, i) => (
            <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block card animate-fade-in" style={{ padding: 12, marginBottom: 8 }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", transition: "color 0.15s ease" }}>{r.name}</h4>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{r.description}</p>
                  <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }} className="truncate">{r.url}</p>
                  {r.citation && (
                    <div className="mt-1.5 pt-1.5 border-t border-zinc-100 dark:border-zinc-800 flex items-start gap-1 group/cite">
                      <p className="flex-1 text-[10px] text-zinc-400 italic leading-relaxed select-all">
                        {r.citation}
                      </p>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(r.citation);
                        }}
                        className="shrink-0 text-[10px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded hover:bg-blue-100 hover:text-blue-600 opacity-0 group-hover/cite:opacity-100 transition-opacity"
                        title="复制引用"
                      >
                        复制
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      {!hasLoaded && !error && <div className="flex items-center justify-center flex-1" style={{ fontSize: 14, color: "var(--text-tertiary)" }}>点击按钮获取相关学术网站</div>}
      {hasLoaded && resources.length === 0 && !error && <div className="flex items-center justify-center flex-1" style={{ fontSize: 14, color: "var(--text-tertiary)" }}>未找到相关资源</div>}
    </div>
  );
}

// ── Chat Tab ──

// ── Chapter References Section ──

function parseRefAuthors(authorsJson: string): string {
  try {
    const arr = JSON.parse(authorsJson) as { family: string; given: string }[];
    if (arr.length === 0) return "";
    if (arr.length === 1) return arr[0].family;
    if (arr.length === 2) return `${arr[0].family} & ${arr[1].family}`;
    return `${arr[0].family} et al.`;
  } catch { return ""; }
}

// Generate APA in-text citation per doc 112 rules
function inTextCitation(authorsJson: string, year: number | null): string {
  try {
    const arr = JSON.parse(authorsJson) as { family: string; given: string }[];
    const yr = year?.toString() ?? "n.d.";
    if (arr.length === 0) return `(n.d.)`;
    if (arr.length === 1) return `(${arr[0].family}, ${yr})`;
    if (arr.length === 2) return `(${arr[0].family} & ${arr[1].family}, ${yr})`;
    return `(${arr[0].family} et al., ${yr})`;
  } catch { return "(n.d.)"; }
}

// Narrative form: Author (Year)
function narrativeCitation(authorsJson: string, year: number | null): string {
  try {
    const arr = JSON.parse(authorsJson) as { family: string; given: string }[];
    const yr = year?.toString() ?? "n.d.";
    if (arr.length === 0) return `(n.d.)`;
    if (arr.length === 1) return `${arr[0].family} (${yr})`;
    if (arr.length === 2) return `${arr[0].family} and ${arr[1].family} (${yr})`;
    return `${arr[0].family} et al. (${yr})`;
  } catch { return "n.d."; }
}

function RefSection({ node, onReload }: { node: FlatNode; onReload: () => void }) {
  const refs = node.outlineReferences ?? [];
  const [collapsed, setCollapsed] = useState(true);
  const [showAdder, setShowAdder] = useState(false);
  const [doiInput, setDoiInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const handleAddDoi = async () => {
    const raw = doiInput.trim();
    if (!raw) return;
    setAdding(true);
    setAddError("");

    try {
      // Try DOI lookup if present, fallback to plain text
      const doiMatch = raw.match(/10\.\d{4,}\/[^\s"')\]]+/i);
      const doi = doiMatch ? doiMatch[0].replace(/[.,;]+$/, "") : null;
      let result;
      if (doi) {
        result = await lookupAndSaveDOI(node.projectId, doi);
        // If already exists, still link it
      }
      if (!result?.success) {
        result = await saveSimpleReference(node.projectId, raw);
      }
      if (result?.success && result.reference) {
        await linkReference(node.id, result.reference.id);
        setDoiInput("");
        setShowAdder(false);
        setAddError("");
        onReload();
      }
    } catch {
      setAddError("添加失败，请重试");
    }
    setAdding(false);
  };

  return (
    <div className="shrink-0" style={{ borderTop: "1px solid var(--border-default)" }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between"
        style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", transition: "background 0.15s ease" }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
        onMouseLeave={e => e.currentTarget.style.background = "none"}
      >
        <span style={{ fontSize: 12, fontWeight: 500 }}>
          本章引用 {refs.length > 0 ? `(${refs.length})` : ""}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 space-y-2">
          {refs.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {refs.map((or, i) => {
                const r = or.reference;
                const authors = parseRefAuthors(r.authors);
                const year = r.year ?? "n.d.";
                return (
                  <div key={or.id} className="flex items-start gap-2 group py-1">
                    <span className="text-[10px] text-zinc-400 mt-0.5 shrink-0">[{i + 1}]</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6 }}>
                        {authors ? `${authors} ` : ""}({year}). {r.title}
                        {r.journal ? `. ${r.journal}` : ""}
                        {r.volume ? `, ${r.volume}` : ""}
                        {r.issue ? `(${r.issue})` : ""}
                        {r.pages ? `, ${r.pages}` : ""}.
                      </p>
                      <p style={{ fontSize: 10, color: "var(--brand)", marginTop: 2 }}>
                        文内引用：{inTextCitation(r.authors, r.year)}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await unlinkReference(or.id);
                        onReload();
                      }}
                      className="shrink-0 text-[10px] text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="移除引用"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add reference */}
          {!showAdder ? (
            <button
              onClick={() => setShowAdder(true)}
              style={{ fontSize: 12, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontWeight: 500 }}
            >
              + 添加文献
            </button>
          ) : (
            <div className="space-y-2">
              <p style={{ fontSize: 10, color: "var(--text-tertiary)" }}>粘贴引用文本或 DOI 添加文献到本章：</p>
              <div className="flex gap-2">
                <input
                  value={doiInput}
                  onChange={e => { setDoiInput(e.target.value); setAddError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleAddDoi(); }}
                  placeholder="粘贴引用文本、DOI 或 PubMed 格式"
                  disabled={adding}
                  className="input-field"
                  style={{ flex: 1, height: 32, fontSize: 12 }}
                />
                <button
                  onClick={handleAddDoi}
                  disabled={adding || !doiInput.trim()}
                  className="btn btn-primary"
                  style={{ height: 32, fontSize: 12, padding: "0 10px" }}
                >
                  {adding ? "查找中..." : "添加"}
                </button>
              </div>
              {addError && <p style={{ color: "#ef4444", fontSize: 10 }}>{addError}</p>}
              <button onClick={() => { setShowAdder(false); setAddError(""); }} className="btn btn-ghost" style={{ height: 24, fontSize: 10 }}>取消</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Citation Normalizer Tab ──

function NormTab({ node, lang }: { node: FlatNode; lang: string }) {
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const formatName = lang === "en"
    ? { "c-gb7714": "GB/T 7714", "c-apa7": "APA 7th", "c-mla9": "MLA 9th", "c-ieee": "IEEE", "c-nlm": "NLM" }
    : { "c-gb7714": "GB/T 7714", "c-apa7": "APA 7th", "c-mla9": "MLA 9th", "c-ieee": "IEEE", "c-nlm": "NLM" };

  // Key simplified for user display
  const formatLabels: Record<string, string> = {
    "GB/T 7714": "GB/T 7714", "APA 7th": "APA 7th", "MLA 9th": "MLA 9th", "IEEE": "IEEE", "NLM": "NLM",
    GB: "GB/T 7714", APA: "APA 7th", MLA: "MLA 9th",
  };

  const [targetFormat, setTargetFormat] = useState(lang === "zh" ? "GB/T 7714" : "APA 7th");

  const handleNormalize = async () => {
    if (!rawText.trim()) return;
    setLoading(true); setError(""); setResult("");
    const r = await normalizeCitation(rawText.trim(), targetFormat, lang);
    if (r.success && r.citation) setResult(r.citation);
    else setError(r.error ?? "格式化失败");
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>目标格式：</span>
        <select
          value={targetFormat}
          onChange={e => setTargetFormat(e.target.value)}
          className="input-field"
          style={{ height: 30, fontSize: 12, padding: "0 6px" }}
        >
          {(lang === "zh"
            ? ["GB/T 7714"]
            : ["APA 7th", "MLA 9th", "IEEE", "NLM"]
          ).map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <textarea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder="粘贴任意格式的参考文献，如 PMID 格式、PubMed 格式、或其他不规范格式..."
        className="input-field"
        style={{ width: "100%", height: 120, padding: 10, fontSize: 12, lineHeight: 1.6, resize: "none", fontFamily: "system-ui, sans-serif" }}
      />

      <div className="flex gap-2 shrink-0">
        <button onClick={handleNormalize} disabled={loading || !rawText.trim()}
          className="btn" style={{ flex: 1, height: 34, fontSize: 12, background: "linear-gradient(135deg, #d4915e, #b86838)", color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(201,122,78,0.25)" }}>
          {loading ? <><span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />解析中...</> : "转为规范格式"}
        </button>
        {(rawText || result) && (
          <button onClick={() => { setRawText(""); setResult(""); }}
            className="btn btn-secondary" style={{ height: 34, fontSize: 12 }}>
            清除
          </button>
        )}
      </div>

      {error && <p className="text-red-500 text-xs shrink-0">{error}</p>}

      {result && (
        <div className="flex-1 flex flex-col min-h-0 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between shrink-0">
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{targetFormat} 格式</span>
            <button onClick={handleCopy} className="btn btn-ghost" style={{ height: 24, fontSize: 10, padding: "0 8px" }}>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto select-all" style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border-default)", fontSize: 12, lineHeight: 1.6, color: "var(--text-primary)", wordBreak: "break-word" }}>
            {result}
          </div>
          <div className="shrink-0" style={{ padding: 10, borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)", border: "1px solid var(--border-default)" }}>
            <p style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500 }}>{targetFormat} Journal Article Template</p>
            <p style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.6, wordBreak: "break-word" }}>
              {TEMPLATES[targetFormat] ?? "Select a format"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const TEMPLATES: Record<string, string> = {
  "APA 7th": "Author, A. A., & Author, B. B. (Year). Title of article in sentence case. Journal Name in Title Case, Volume(Issue), Pages. https://doi.org/xx.xxx/xxxx",
  "MLA 9th": "Author, First M., and First M. Author. \"Title of Article in Title Case.\" Journal Name in Title Case, vol. X, no. X, Year, pp. XX-XX. doi:xx.xxx/xxxx.",
  "IEEE": "A. A. Author and B. B. Author, \"Title of article in title case,\" Abbrev. Journal Name, vol. X, no. X, pp. XX-XX, Year. doi:xx.xxx/xxxx.",
  "NLM": "Author AA, Author BB. Title of article in sentence case. Abbrev J Name. Year;Vol(Issue):Pages. doi:xx.xxx/xxxx.",
  "GB/T 7714": "作者. 文章标题[J]. 期刊名, 年份, 卷(期): 页码.",
};

// ── Chat Tab ──

function ChatTab({ node }: { node: FlatNode }) {
  const [messages, setMessages] = useState<{ id: string; role: string; content: string; createdAt: Date }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");


  const [input, setInput] = useState("");
  const nodeRef = useRef<string>("");

  useEffect(() => {
    nodeRef.current = node.id;
    setError("");
    getChatHistory(node.id).then(r => { if (r.success && nodeRef.current === node.id) setMessages(r.messages ?? []); });
  }, [node.id]);

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
      setError(r.error ?? "发送失败");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col min-h-[350px]">
      <div className="space-y-3 mb-3" style={{ minHeight: "200px" }}>
        {messages.length === 0 && !isLoading && <div style={{ textAlign: "center", fontSize: 14, color: "var(--text-tertiary)", marginTop: 16 }}>向 AI 提问开始协作</div>}
        {messages.map(msg => (
          <div key={msg.id} className={`flex animate-fade-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap`}
              style={{
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                lineHeight: 1.65,
                background: msg.role === "user" ? "var(--brand)" : "var(--bg-subtle)",
                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                boxShadow: msg.role === "user" ? "var(--shadow-glow)" : "none",
              }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div style={{ padding: "10px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg-subtle)" }}>
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)", animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)", animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>
      {error && (
        <div style={{ marginBottom: 8, fontSize: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: "rgba(239,68,68,0.06)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>&times;</button>
        </div>
      )}
      <div className="flex gap-2 shrink-0">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="输入消息..." disabled={isLoading} className="input-field" style={{ flex: 1, height: 38, fontSize: 13 }} />
        <button onClick={handleSend} disabled={isLoading} className="btn" style={{ height: 38, fontSize: 13, padding: "0 16px", flexShrink: 0, background: "linear-gradient(135deg, #6b9fd4, #4a7ab5)", color: "#fff", border: "none", boxShadow: "0 2px 8px rgba(91,140,201,0.25)" }}>发送</button>
      </div>
    </div>
  );
}

// ── Linear Icons (18px, stroke-width 1.5, per-tab colors) ──

function NotesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" opacity="0.4" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M12 15l.75 2.25L15 18l-2.25.75L12 21l-.75-2.25L9 18l2.25-.75z" opacity="0.6" />
    </svg>
  );
}

function ResourcesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" opacity="0.3" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="none" />
      <line x1="9" y1="7" x2="16" y2="7" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
      <line x1="9" y1="11" x2="14" y2="11" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function CiteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" strokeLinejoin="round">
      <path d="M10 13H6V7h4v2H8v2h2v2z" />
      <path d="M18 13h-4V7h4v2h-2v2h2v2z" />
    </svg>
  );
}

