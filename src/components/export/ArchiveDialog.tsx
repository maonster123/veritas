"use client";

import { useEffect, useState } from "react";
import { listProjects } from "@/app/actions/project";

interface Props {
  isZh: boolean;
  onClose: () => void;
}

export default function ArchiveDialog({ isZh, onClose }: Props) {
  const [projects, setProjects] = useState<{ id: string; title: string; subtitle: string | null; lang: string; updatedAt: Date }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects().then(r => {
      if (r.success && r.projects) setProjects(r.projects);
      setLoading(false);
    });
  }, []);

  const t = {
    title: isZh ? "存档" : "Archive",
    empty: isZh ? "暂无存档项目" : "No archived projects",
    updated: isZh ? "更新于" : "Updated",
    cn: isZh ? "中文" : "CN",
    en: isZh ? "英文" : "EN",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t.title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-sm text-zinc-400 text-center py-8">Loading...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">{t.empty}</p>
          ) : (
            projects.map(p => (
              <a key={p.id} href={`/?projectId=${p.id}`}
                className="block p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-indigo-400 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{p.title}</h4>
                    {p.subtitle && <p className="text-xs text-zinc-500 mt-0.5 truncate">{p.subtitle}</p>}
                    <p className="text-[10px] text-zinc-400 mt-1">{t.updated}: {new Date(p.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <span className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    {p.lang === "zh" ? t.cn : t.en}
                  </span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
