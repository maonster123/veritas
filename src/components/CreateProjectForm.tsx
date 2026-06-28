"use client";

import { useState } from "react";
import { createProject } from "@/app/actions/project";
import AnimatedBackground from "@/components/AnimatedBackground";

const FORMATS: Record<string, { id: string; name: string; desc: string }[]> = {
  zh: [
    { id: "c-gb7714", name: "GB/T 7714", desc: "China national standard for theses and journals" },
  ],
  en: [
    { id: "c-apa7", name: "APA 7th", desc: "Psychology, education, social sciences" },
    { id: "c-mla9", name: "MLA 9th", desc: "Literature, linguistics, humanities" },
    { id: "c-ieee", name: "IEEE", desc: "Engineering, computer science, technology" },
    { id: "c-nlm", name: "NLM", desc: "Biomedical and life sciences" },
  ],
};

export default function CreateProjectForm() {
  const [step, setStep] = useState<"lang" | "format">("lang");
  const [lang, setLang] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePickLang = (l: string) => { setLang(l); setStep("format"); };

  const handlePickFormat = async (citationStyleId: string) => {
    setLoading(true); setError("");
    const result = await createProject(lang, citationStyleId);
    if (result?.error) { setError(result.error); setLoading(false); }
  };

  const handleBack = () => { setStep("lang"); setError(""); };

  if (step === "lang") {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <AnimatedBackground />
        <div className="relative z-10 w-full max-w-lg mx-auto px-6">
          <div className="glass-card rounded-2xl p-10 space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">New Project</h1>
              <p className="text-sm text-slate-400">Choose your thesis language</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handlePickLang("zh")}
                className="p-6 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all duration-300 group text-center">
                <div className="text-3xl mb-3">&#x1F4DD;</div>
                <div className="text-sm font-semibold text-white group-hover:text-indigo-300">Chinese</div>
                <div className="text-xs text-slate-500 mt-1">GB/T 7714</div>
              </button>
              <button onClick={() => handlePickLang("en")}
                className="p-6 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 group text-center">
                <div className="text-3xl mb-3">&#x1F4C4;</div>
                <div className="text-sm font-semibold text-white group-hover:text-cyan-300">English</div>
                <div className="text-xs text-slate-500 mt-1">APA · MLA · IEEE · NLM</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formats = FORMATS[lang] ?? [];
  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <AnimatedBackground />
      <div className="relative z-10 w-full max-w-lg mx-auto px-6">
        <div className="glass-card rounded-2xl p-10 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white">Citation Style</h1>
            <p className="text-sm text-slate-400">{lang === "zh" ? "Chinese thesis" : "English thesis"}</p>
          </div>
          <div className="space-y-2">
            {formats.map((fmt) => (
              <button key={fmt.id} onClick={() => handlePickFormat(fmt.id)} disabled={loading}
                className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-indigo-500/30 transition-all duration-300 group text-left disabled:opacity-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-indigo-300">{fmt.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{fmt.desc}</div>
                </div>
                <svg className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
          <button onClick={handleBack} disabled={loading}
            className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-2">
            &#x2190; Back to language
          </button>
          {loading && <p className="text-center text-sm text-slate-400">Creating project...</p>}
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
