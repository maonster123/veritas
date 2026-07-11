"use client";

import { useEffect, useState } from "react";

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem("veritas-banner-dismissed") === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="w-full py-2 px-4 flex items-center justify-center gap-2 bg-black/80 border-b border-indigo-500/20 text-xs text-slate-400">
      <span>📢 内测阶段，如有问题或建议请联系：2492603854@qq.com</span>
      <button
        onClick={() => {
          localStorage.setItem("veritas-banner-dismissed", "1");
          setDismissed(true);
        }}
        className="ml-2 text-slate-500 hover:text-slate-300 transition-colors text-sm leading-none"
        aria-label="关闭"
      >
        &times;
      </button>
    </div>
  );
}
