"use client";

import { useState } from "react";
import { updateProject } from "@/app/actions/project";
import { generateKeywords } from "@/app/actions/ai-generate";

interface TitlePageInfo {
  authorName: string;
  institution: string;
  course: string;
  instructor: string;
  date: string;
}

interface Props {
  projectId: string;
  title: string;
  keywords: string | null;
  titlePage: string | null;
  isEnglish: boolean;
  onClose: () => void;
}

export default function ExportDialog({ projectId, title, keywords, titlePage, isEnglish, onClose }: Props) {
  const parsed: TitlePageInfo = titlePage ? (() => { try { return JSON.parse(titlePage); } catch { return {}; } })() : {};
  const [authorName, setAuthorName] = useState(parsed.authorName ?? "");
  const [institution, setInstitution] = useState(parsed.institution ?? "");
  const [course, setCourse] = useState(parsed.course ?? "");
  const [instructor, setInstructor] = useState(parsed.instructor ?? "");
  const [date, setDate] = useState(parsed.date ?? "");
  const [kw, setKw] = useState(keywords ?? "");
  const [loadingKw, setLoadingKw] = useState(false);
  const [saving, setSaving] = useState(false);

  const labels = isEnglish
    ? { author: "Author Name", institution: "Institution / University", course: "Course Name & Number", instructor: "Instructor Name", date: "Due Date (e.g. June 24, 2026)", kwLabel: "Keywords", kwPlaceholder: "keyword1, keyword2, keyword3", exportWord: "Export Word", exportPdf: "Export PDF", preview: "Print Preview" }
    : { author: "作者姓名", institution: "学校 / 机构", course: "课程名称及编号", instructor: "指导教师", date: "提交日期", kwLabel: "关键词", kwPlaceholder: "关键词1, 关键词2, 关键词3", exportWord: "导出 Word", exportPdf: "导出 PDF", preview: "打印预览" };

  const save = async () => {
    setSaving(true);
    const info = JSON.stringify({ authorName, institution, course, instructor, date });
    await updateProject(projectId, { keywords: kw || null, titlePage: info });
    setSaving(false);
  };

  const handleExportWord = async () => {
    await save();
    window.open(`/api/export/docx?projectId=${projectId}`, "_blank");
    onClose();
  };

  const handleExportPdf = async () => {
    await save();
    const res = await fetch(`/api/export/save-pdf?projectId=${projectId}`);
    const data = await res.json();
    if (data.success) alert(`${isEnglish ? "Saved to Desktop:" : "已保存到桌面："} ${data.path}`);
    else alert(data.error ?? "Failed");
    onClose();
  };

  const handlePreview = () => {
    save().then(() => window.open(`/export?projectId=${projectId}`, "_blank"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{isEnglish ? "APA 7th Title Page" : "APA 第7版 标题页信息"}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg">&times;</button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          <Field label={labels.author} value={authorName} onChange={setAuthorName} />
          <Field label={labels.institution} value={institution} onChange={setInstitution} />
          <Field label={labels.course} value={course} onChange={setCourse} />
          <Field label={labels.instructor} value={instructor} onChange={setInstructor} />
          <Field label={labels.date} value={date} onChange={setDate} placeholder="June 24, 2026" />

          {/* Keywords */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{labels.kwLabel}</label>
            <textarea
              value={kw}
              onChange={e => setKw(e.target.value)}
              placeholder={labels.kwPlaceholder}
              rows={3}
              className="w-full text-xs bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={async () => {
                setLoadingKw(true);
                const r = await generateKeywords(projectId);
                if (r.success && r.keywords) setKw(r.keywords);
                setLoadingKw(false);
              }}
              disabled={loadingKw}
              className="mt-2 text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loadingKw ? "AI 分析中..." : "AI 识别关键词"}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">{saving ? "保存中..." : ""}</span>
          <div className="flex gap-2">
            <button onClick={handlePreview} className="text-xs px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">{labels.preview}</button>
            <button onClick={handleExportPdf} className="text-xs px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700">{labels.exportPdf}</button>
            <button onClick={handleExportWord} className="text-xs px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{labels.exportWord}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
