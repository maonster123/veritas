"use client";

import { useState } from "react";
import { loginUser } from "@/app/actions/auth";
import { useRouter } from "next/navigation";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await loginUser(email, password);
    if (result.success) {
      router.push("/");
      router.refresh();
    } else {
      setError(result.error ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-md mx-auto px-6">
        <div className="glass-card rounded-2xl p-8 space-y-6">

          {/* Back link */}
          <a href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </a>

          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-white">Welcome back</h1>
            <p className="text-sm text-slate-400">Sign in to continue your research</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="········"
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-600"
              />
            </div>
            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl text-sm font-semibold hover:from-indigo-400 hover:to-cyan-400 transition-all duration-300 disabled:opacity-50 shadow-lg shadow-indigo-500/25"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <a href="/auth/register" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Register
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
