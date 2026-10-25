"use client";

import React, { useState } from "react";
import { X, User, Mail, Lock, Building, IdCard, Loader2, Sparkles, CheckCircle } from "lucide-react";
import { authApi } from "@/services/authApi";
import type { Student } from "@/types/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (student: Student) => void;
  initialMode?: "login" | "signup";
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "login",
}) => {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Please enter your full name.");
        if (!studentId.trim()) throw new Error("Please enter your Student ID.");
        if (!collegeName.trim()) throw new Error("Please enter your college name.");
        if (!email.trim()) throw new Error("Please enter a valid email address.");
        if (password.length < 4) throw new Error("Password must be at least 4 characters.");

        const res = await authApi.signUp({
          name: name.trim(),
          studentId: studentId.trim(),
          collegeName: collegeName.trim(),
          email: email.trim(),
          password,
        });
        onSuccess(res.student);
        onClose();
      } else {
        if (!email.trim() || !password) throw new Error("Please enter both email and password.");
        const res = await authApi.login({
          email: email.trim(),
          password,
        });
        onSuccess(res.student);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-2xl overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              Z
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Student Portal
            </span>
          </div>

          <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
            {mode === "signup" ? "Create Student Account" : "Sign in to Workspace"}
          </h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
            {mode === "signup"
              ? "Register to track test results and persist solutions across sessions."
              : "Sign in with your student credentials to restore your progress."}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] mt-4">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "login"
                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "signup"
                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {mode === "signup" && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                    />
                  </div>
                </div>

                {/* Student ID & College Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                      Student ID
                    </label>
                    <div className="relative">
                      <IdCard className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="CS2026-042"
                        className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                      College
                    </label>
                    <div className="relative">
                      <Building className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        placeholder="MIT"
                        className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                Email or Student ID
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={mode === "signup" ? "email" : "text"}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu or 2024-CS-108"
                  className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94a3b8] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-8 pr-3 py-1.5 bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#cbd5e1] dark:border-[#232f45] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === "signup" ? (
                <span>Register and Start Solving</span>
              ) : (
                <span>Sign in to Workspace</span>
              )}
            </button>
          </form>

          {/* Footer toggle note */}
          <div className="mt-4 pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] text-center text-[11px] text-[#64748b] dark:text-[#94a3b8]">
            {mode === "signup" ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Sign in
                </button>
              </span>
            ) : (
              <span>
                New student?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Create account
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
