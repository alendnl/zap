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

import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden transition-colors duration-200">
      {/* Top right utility bar: Environment & Theme */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <EnvironmentSwitcher />
        <ThemeToggle />
      </div>

      {/* Background ambient radial gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 tracking-wider uppercase">
              Technical Interview Platform
            </span>
          </div>

          <div className="flex items-center justify-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center shadow-md shadow-blue-600/25">
              Z
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
              ZAP
            </h1>
          </div>

          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-xs mx-auto leading-relaxed">
            Practice algorithms, run solutions in sandboxed runtimes, and master your technical interview.
          </p>
        </div>

        {/* Intended Target Challenge Notice */}
        {intendedProblemSlug && (
          <div className="mb-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3 text-left flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                Target Challenge:{" "}
                <span className="font-bold underline decoration-blue-500">
                  {intendedProblemTitle || intendedProblemSlug}
                </span>
              </div>
              <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                Sign in or register below to open this problem immediately.
              </p>
            </div>
          </div>
        )}

        {/* Minimalist Centered Auth Card */}
        <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-xl shadow-slate-900/5 dark:shadow-black/40 overflow-hidden transition-colors">
          {/* Subtle Top Accent */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

          {/* Segmented Mode Tab Switcher */}
          <div className="grid grid-cols-2 p-1 m-5 mb-4 bg-[#f1f5f9] dark:bg-[#0b0f17] rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
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
                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3.5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs">
                {error}
              </div>
            )}

            {mode === "signup" && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Johnson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* Student ID / Roll Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                    Student ID / Roll Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2024-CS-108"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="w-full bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* College Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                    College / University Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. MIT / IIT Delhi"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email / Identifier */}
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                {mode === "login" ? "Email Address or Student ID" : "Email Address"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
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
                  className="w-full bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
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
                      ? "Sign In & Enter Workspace"
                      : "Create Student Account"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="px-6 py-3 bg-[#f8fafc] dark:bg-[#0e1420] border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-center gap-2 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Dedicated DSA & Technical Interview Preparation</span>
          </div>
        </div>
      </div>
    </div>
  );
};
