"use client";

import { useState } from "react";
import { updateProject } from "@/app/actions/project";

interface Props {
  projectId: string;
  title: string;
  subtitle: string | null;
}

export default function ProjectTitleBar({ projectId, title, subtitle }: Props) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [subtitleDraft, setSubtitleDraft] = useState(subtitle ?? "");

  const saveTitle = async () => {
    const t = titleDraft.trim();
    if (t && t !== title) await updateProject(projectId, { title: t });
    setEditingTitle(false);
  };
  const saveSubtitle = async () => {
    const t = subtitleDraft.trim();
    if (t !== (subtitle ?? "")) await updateProject(projectId, { subtitle: t || undefined });
    setEditingSubtitle(false);
  };

  return (
    <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border-default)" }}>
      {editingTitle ? (
        <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
          onBlur={saveTitle} onKeyDown={e => { if (e.key === "Enter") saveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
          className="input-field" style={{ width: "100%", fontWeight: 600, fontSize: 16 }} />
      ) : (
        <h1 className="heading-sm" style={{ cursor: "pointer", color: "var(--text-primary)" }}
          onClick={() => setEditingTitle(true)}>
          {title || "Untitled"}
        </h1>
      )}

      <div style={{ marginTop: 4 }}>
        {editingSubtitle ? (
          <input autoFocus value={subtitleDraft} onChange={e => setSubtitleDraft(e.target.value)}
            onBlur={saveSubtitle} onKeyDown={e => { if (e.key === "Enter") saveSubtitle(); if (e.key === "Escape") { setEditingSubtitle(false); setSubtitleDraft(subtitle ?? ""); } }}
            placeholder="Add subtitle..."
            className="input-field" style={{ width: "100%", fontSize: 14, color: "var(--text-secondary)" }} />
        ) : subtitle ? (
          <p style={{ fontSize: 14, cursor: "pointer", color: "var(--text-secondary)" }}
            onClick={() => { setEditingSubtitle(true); setSubtitleDraft(subtitle); }}>
            {subtitle}
          </p>
        ) : (
          <p style={{ fontSize: 14, cursor: "pointer", color: "var(--text-tertiary)" }}
            onClick={() => setEditingSubtitle(true)}>
            Add subtitle...
          </p>
        )}
      </div>
    </div>
  );
}
