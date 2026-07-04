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
    <div className="flex items-center gap-1.5" style={{ padding: "4px 4px" }}>
      {singleType ? (
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: "var(--radius-xs)",
          background: "var(--bg-subtle)", color: "var(--text-tertiary)", fontWeight: 500, flexShrink: 0,
        }}>
          {typeLabels[types[0]] ?? types[0]}
        </span>
      ) : (
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="input-field"
          style={{ height: 30, fontSize: 12, padding: "0 6px", width: "auto", flexShrink: 0 }}
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
        className="input-field"
        style={{ flex: 1, minWidth: 0, height: 30, fontSize: 13 }}
      />
      <button
        onClick={handleSubmit}
        className="btn btn-primary"
        style={{ height: 30, fontSize: 12, padding: "0 10px", flexShrink: 0 }}
      >
        确定
      </button>
      <button
        onClick={onCancel}
        className="btn btn-ghost"
        style={{ height: 30, fontSize: 12, padding: "0 8px", flexShrink: 0 }}
      >
        取消
      </button>
    </div>
  );
}
