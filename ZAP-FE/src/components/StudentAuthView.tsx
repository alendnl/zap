"use client";

import React, { useState } from "react";
import {
  User,
  Mail,
  Lock,
  Building,
  IdCard,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Code2,
} from "lucide-react";
import { authApi } from "@/services/authApi";
import type { Student } from "@/types/auth";

interface StudentAuthViewProps {
  onSuccess: (student: Student) => void;
  intendedProblemSlug?: string | null;
  intendedProblemTitle?: string | null;
  initialMode?: "login" | "signup";
}

export const StudentAuthView: React.FC<StudentAuthViewProps> = ({
  onSuccess,
  intendedProblemSlug,
  intendedProblemTitle,
  initialMode = "login",
}) => {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your full name.");
        if (!studentId.trim()) throw new Error("Please enter your Student ID / Roll Number.");
        if (!collegeName.trim()) throw new Error("Please enter your college name.");
        if (!email.trim()) throw new Error("Please enter a valid email address.");
        if (password.length < 4) throw new Error("Password must be at least 4 characters long.");

        const res = await authApi.signUp({
          name: name.trim(),
          studentId: studentId.trim(),
          collegeName: collegeName.trim(),
          email: email.trim(),
          password,
        });
        onSuccess(res.student);
      } else {
        if (!email.trim() || !password) {
          throw new Error("Please enter your Email/Student ID and Password.");
        }
        const res = await authApi.login({
          email: email.trim(),
          password,
        });
        onSuccess(res.student);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-sky-500/15 via-indigo-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-950/70 border border-sky-800/60 mb-3 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs font-semibold text-sky-300 tracking-wide uppercase">
              Student Interview & DSA Portal
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-black text-xl shadow-lg shadow-sky-500/10">
              Z
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              ZAP <span className="text-sky-400 font-extrabold">ARENA</span>
            </h1>
          </div>

          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Practice algorithmic challenges, compile solutions in real-time, and get campus interview ready.
          </p>
        </div>

        {/* Challenge Gating Banner */}
        {intendedProblemSlug && (
          <div className="mb-4 bg-sky-950/40 border border-sky-800/60 rounded-xl p-3 text-left flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-sky-200">
                Target Challenge:{" "}
                <span className="text-white font-bold underline decoration-sky-400">
                  {intendedProblemTitle || intendedProblemSlug}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sign in or register below. You will be directed straight into this problem immediately upon authentication.
              </p>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
          {/* Card Accent Top Bar */}
          <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500" />

          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1.5 m-5 mb-4 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700/80"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Student Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              New Student Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3.5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {mode === "signup" && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Johnson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Student ID */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Student ID / Roll Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2024-CS-108"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>

                {/* College Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    College / University Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stanford University"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email / Identifier */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                {mode === "login" ? "Email Address or Student ID" : "Email Address"}{" "}
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type={mode === "signup" ? "email" : "text"}
                  required
                  placeholder={
                    mode === "login"
                      ? "student@college.edu or 2024-CS-108"
                      : "student@college.edu"
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Password <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === "login"
                      ? "Sign In & Enter Arena"
                      : "Create Student Account"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dedicated DSA environment for university students</span>
          </div>
        </div>
      </div>
    </div>
  );
};
