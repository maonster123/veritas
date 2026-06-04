"use client";

import { useState } from "react";
import { createProject } from "@/app/actions/project";

export default function CreateProjectForm() {
  const [loading, setLoading] = useState(false);

  const handleCreate = async (lang: string) => {
    setLoading(true);
    const result = await createProject(lang);
    if (result.success) {
      window.location.reload();
    } else {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">
          论文大纲管理系统
        </h1>
        <p className="text-zinc-500 text-sm">
          请选择论文类型以开始
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleCreate("zh")}
            disabled={loading}
            className="flex-1 max-w-[200px] px-6 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all disabled:opacity-50 group"
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              中文论文
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              GB/T 7714
            </div>
          </button>
          <button
            onClick={() => handleCreate("en")}
            disabled={loading}
            className="flex-1 max-w-[200px] px-6 py-4 bg-white dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 transition-all disabled:opacity-50 group"
          >
            <div className="text-2xl mb-2">📄</div>
            <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              English Thesis
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              APA / MLA / IEEE
            </div>
          </button>
        </div>
        {loading && (
          <p className="text-sm text-zinc-400">创建中...</p>
        )}
      </div>
    </div>
  );
}
