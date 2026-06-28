"use client";

import { useState } from "react";

interface Props {
  onAdd: (title: string, type: string) => void;
  onCancel: () => void;
  types: string[];
  typeLabels: Record<string, string>;
}

export default function AddNodeForm({ onAdd, onCancel, types, typeLabels }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(types[0]);

  const handleSubmit = () => {
    if (title.trim()) {
      onAdd(title.trim(), type);
      setTitle("");
    }
  };

  const singleType = types.length === 1;

  return (
    <div className="flex items-center gap-1.5 py-1 px-1">
      {singleType ? (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 shrink-0">
          {typeLabels[types[0]] ?? types[0]}
        </span>
      ) : (
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-1.5 py-1"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {typeLabels[t] ?? t}
            </option>
          ))}
        </select>
      )}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="标题..."
        className="flex-1 min-w-0 text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        onClick={handleSubmit}
        className="text-xs px-1.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
      >
        确定
      </button>
      <button
        onClick={onCancel}
        className="text-xs px-1.5 py-1 text-zinc-500 hover:text-zinc-700 shrink-0"
      >
        取消
      </button>
    </div>
  );
}
