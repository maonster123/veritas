"use client";

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const Spline = dynamic(() => import("@splinetool/react-spline/next"), { ssr: false });

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: "#0b1121" }}>
      {/* Spline 3D scene */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-br from-[#0b1121] via-[#131b33] to-[#0f172a]" />}>
          <Spline
            scene="https://prod.spline.design/v4HbHLsfEwL-g3to/scene.splinecode"
            className="w-full h-full"
          />
        </Suspense>
      </div>

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-transparent to-[#0b1121]/50 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-6">
        <div className="glass-card rounded-2xl p-10 space-y-8">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Thesis Outline</h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">AI-powered academic writing assistant. Structure your research, format citations, and export polished papers.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/auth/login" className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-400 hover:to-cyan-400 transition-all duration-300 text-center shadow-lg shadow-indigo-500/25">
              Start Writing
            </Link>
            <Link href="/auth/register" className="w-full py-3 px-4 bg-white/5 text-slate-300 rounded-xl text-sm font-medium hover:bg-white/10 transition-all duration-300 text-center border border-white/5">
              Create Account
            </Link>
          </div>
          <p className="text-center text-xs text-slate-500">APA 7th · MLA 9th · IEEE · NLM · GB/T 7714</p>
        </div>
      </div>
    </div>
  );
}
