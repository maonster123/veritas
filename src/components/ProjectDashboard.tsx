"use client";

import { useState } from "react";
import CreateProjectForm from "@/components/CreateProjectForm";
import { signOut } from "next-auth/react";
import { deleteProject } from "@/app/actions/project";

interface Props {
  projects: { id: string; title: string; subtitle: string | null; lang: string; updatedAt: Date }[];
}

export default function ProjectDashboard({ projects: initialProjects }: Props) {
  const [showNew, setShowNew] = useState(false);
  const [projects, setProjects] = useState(initialProjects);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this project?")) return;
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  if (showNew) return <CreateProjectForm />;

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ background: "#0b1121" }}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl animate-float-medium" />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto px-6">
        <div className="rounded-2xl p-8 space-y-6" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)" }}>
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-white">Veritas</h1>
            <p className="text-sm text-slate-400">Academic Writing Assistant</p>
          </div>

          {projects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Continue Writing</p>
              {projects.map(p => (
                <a key={p.id} href={`/?projectId=${p.id}`}
                  className="block p-3 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all group">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{p.title}</h4>
                      {p.subtitle && <p className="text-xs text-slate-500 truncate">{p.subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-slate-400">
                        {p.lang === "zh" ? "CN" : "EN"}
                      </span>
                      <button onClick={(e) => handleDelete(p.id, e)}
                        className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete">
                        ✕
                      </button>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          <button onClick={() => setShowNew(true)}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-400 hover:to-cyan-400 transition-all duration-300 text-center shadow-lg shadow-indigo-500/25">
            New Project
          </button>

          <button onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
