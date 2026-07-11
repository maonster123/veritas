"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
}

const steps = [
  {
    emoji: "📝",
    title: "创建项目",
    desc: "选择论文语言与引用格式",
    detail: [
      "点击「New Project」按钮进入创建向导",
      "选择论文语言：中文（GB/T 7714）或 English（APA / MLA / IEEE / NLM）",
      "确认引用格式后输入项目标题",
      "后续可在工具栏随时切换语言",
    ],
  },
  {
    emoji: "🏗️",
    title: "搭建大纲",
    desc: "构建章-节-段落层级树",
    detail: [
      "点击「+」添加章节节点，支持无限子层级",
      "节点类型：章 → 节 → 小节 → 段落，自动层级约束",
      "拖拽排序：拖动节点到目标位置即可重排",
      "双击标题直接重命名，选中节点开始编辑内容",
    ],
  },
  {
    emoji: "✍️",
    title: "写作与引用",
    desc: "AI辅助写作，DOI文献抓取",
    detail: [
      "在右侧 Markdown 编辑区直接撰写正文",
      "点击「AI」标签页，AI 会根据章节标题自动生成学术内容初稿",
      "底部引用区输入 DOI 一键抓取完整文献信息",
      "支持 GB/T 7714、APA 7th、MLA 9th、IEEE、NLM 五种引用格式",
    ],
  },
  {
    emoji: "📄",
    title: "导出论文",
    desc: "导出Word/PDF，自动格式化引用",
    detail: [
      "点击工具栏「导出」按钮打开导出面板",
      "填写标题页信息：作者、学校、课程、导师、日期",
      "AI 自动提取关键词，支持手动编辑",
      "一键导出 Word (.docx) 或打印预览生成 PDF",
    ],
  },
];

export default function OnboardingGuide({ onClose }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      {/* ── 详情面板 ── */}
      {selected !== null ? (
        <div
          className="w-full max-w-md rounded-2xl p-6 space-y-5 border border-white/5 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(20px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelected(null)}
              className="text-slate-500 hover:text-slate-300 transition-colors text-sm"
            >
              ← 返回
            </button>
          </div>

          <div className="text-center space-y-2">
            <div className="text-4xl">{steps[selected].emoji}</div>
            <h3 className="text-base font-bold text-white">{steps[selected].title}</h3>
          </div>

          <div className="space-y-3">
            {steps[selected].detail.map((d, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl p-3 border border-white/5 bg-white/[0.04]"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[11px] flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-300 leading-relaxed">{d}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setSelected(null)}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-400 hover:to-cyan-400 transition-all duration-300 shadow-lg shadow-indigo-500/25"
          >
            知道了
          </button>
        </div>
      ) : (
        /* ── 概览面板 ── */
        <div
          className="w-full max-w-md rounded-2xl p-6 space-y-5 border border-white/5 animate-fade-in"
          style={{
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(20px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-white">欢迎使用 Veritas</h2>
            <p className="text-xs text-slate-400">AI 学术写作助手 · 点击卡片查看详细指引</p>
          </div>

          {/* Steps grid */}
          <div className="grid grid-cols-2 gap-3">
            {steps.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setSelected(i)}
                className="rounded-xl p-4 text-center space-y-1.5 border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all cursor-pointer"
              >
                <div className="text-2xl">{s.emoji}</div>
                <div className="text-sm font-medium text-white">{s.title}</div>
                <div className="text-[11px] text-slate-500">{s.desc}</div>
              </button>
            ))}
          </div>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-400 hover:to-cyan-400 transition-all duration-300 shadow-lg shadow-indigo-500/25"
          >
            开始使用
          </button>
        </div>
      )}
    </div>
  );
}
