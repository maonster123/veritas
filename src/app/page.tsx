"use client";

import { useState, useTransition } from "react";
import { lookupAndSaveDOI } from "@/app/actions/lookup-doi";

// Hardcoded project ID from seed data
const PROJECT_ID = "7a31d02c-309c-4e79-a286-affc2ce05387";

export default function Home() {
  const [doi, setDoi] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [references, setReferences] = useState<
    { id: string; title: string; year: number | null; doi: string | null }[]
  >([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doi.trim()) return;

    setMessage(null);
    startTransition(async () => {
      const result = await lookupAndSaveDOI(PROJECT_ID, doi.trim());
      if (result.success && result.reference) {
        setMessage({
          type: "success",
          text: `已添加: ${result.reference.title} (${result.reference.year ?? "N/A"})`,
        });
        setReferences((prev) => [
          { id: result.reference!.id, title: result.reference!.title, year: result.reference!.year, doi: result.reference!.doi },
          ...prev,
        ]);
        setDoi("");
      } else {
        setMessage({ type: "error", text: result.error ?? "添加失败" });
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col gap-8 w-full max-w-xl px-8 py-32">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            论文文献管理
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            输入 DOI 自动获取文献信息
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="输入 DOI，例如 10.1038/nature14539"
            className="flex-1 h-12 px-4 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPending}
          />
          <button
            type="submit"
            disabled={isPending || !doi.trim()}
            className="h-12 px-6 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "查询中..." : "添加"}
          </button>
        </form>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {references.length > 0 && (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800">
            {references.map((ref) => (
              <div key={ref.id} className="p-4">
                <p className="text-sm font-medium text-black dark:text-zinc-50">
                  {ref.title}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {ref.year ?? "N/A"} &middot; {ref.doi}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
