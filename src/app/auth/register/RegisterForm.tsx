"use client";

import { useState } from "react";
import { registerUser } from "@/app/actions/auth";
import { useRouter } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    const result = await registerUser(name, email, password);
    if (result.success) { router.push("/auth/login"); }
    else { setError(result.error ?? "Registration failed"); setLoading(false); }
  }

  return (
    <div className="relative z-10 w-full max-w-md mx-auto px-6">
      <div className="rounded-2xl p-8 space-y-6" style={{ background: "transparent" }}>
        <a href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back
        </a>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-white">Create Account</h1>
          <p className="text-sm text-slate-400">Start building your thesis today</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-600" /></div>
          <div><label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-600" /></div>
          <div><label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-600" /></div>
          {error && <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-400 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-indigo-500/25">
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="text-center text-xs text-slate-500">Already have an account? <a href="/auth/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">Sign in</a></p>
      </div>
    </div>
  );
}
