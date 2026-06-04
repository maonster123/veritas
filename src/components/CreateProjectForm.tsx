"use client";

import { useState } from "react";
import { createProject } from "@/app/actions/project";

const FORMATS: Record<string, { id: string; name: string; desc: string }[]> = {
  zh: [
    { id: "c-gb7714", name: "GB/T 7714", desc: "中国国家标准，适用于学位论文、期刊投稿" },
  ],
  en: [
    { id: "c-apa7", name: "APA 7th", desc: "美国心理学会格式，社科论文首选" },
    { id: "c-mla9", name: "MLA 9th", desc: "现代语言协会格式，人文学科常用" },
    { id: "c-ieee", name: "IEEE", desc: "电气电子工程师学会格式，理工科常用" },
  ],
};

export default function CreateProjectForm() {
  const [step, setStep] = useState<"lang" | "format">("lang");
  const [lang, setLang] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePickLang = (l: string) => {
    setLang(l);
    setStep("format");
  };

  const handlePickFormat = async (citationStyleId: string) => {
    setLoading(true);
    setError("");
    const result = await createProject(lang, citationStyleId);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("lang");
    setError("");
  };

  // ── Step 1: Choose language ──
  if (step === "lang") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
            论文大纲管理系统
          </h1>
          <p className="text-zinc-500 text-sm">
            请选择论文语言
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => handlePickLang("zh")}
              className="flex-1 max-w-[200px] px-6 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
            >
              <div className="text-2xl mb-2">📝</div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                中文论文
              </div>
            </button>
            <button
              onClick={() => handlePickLang("en")}
              className="flex-1 max-w-[200px] px-6 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
            >
              <div className="text-2xl mb-2">📄</div>
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                English Thesis
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Choose format ──
  const formats = FORMATS[lang] ?? [];

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
          论文大纲管理系统
        </h1>
        <p className="text-zinc-500 text-sm">
          {lang === "zh" ? "中文论文" : "English Thesis"} — 请选择引用格式
        </p>
        <div className="space-y-3">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handlePickFormat(fmt.id)}
              disabled={loading}
              className="w-full px-5 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all disabled:opacity-50 text-left group"
            >
              <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {fmt.name}
              </div>
              <div className="text-xs text-zinc-400 mt-1">
                {fmt.desc}
              </div>
            </button>
          ))}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={handleBack}
            disabled={loading}
            className="text-xs text-zinc-500 hover:text-zinc-700 underline"
          >
            ← 返回选择语言
          </button>
        </div>
        {loading && (
          <p className="text-sm text-zinc-400">创建中...</p>
        )}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
