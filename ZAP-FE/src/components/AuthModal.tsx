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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-3.5 right-3.5 p-1 rounded text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded bg-[#0969da]/10 dark:bg-[#58a6ff]/15 flex items-center justify-center text-[#0969da] dark:text-[#58a6ff] font-semibold text-xs font-mono">
              Z
            </div>
            <span className="text-xs font-medium text-[#656d76] dark:text-[#8d96a0]">
              Student portal
            </span>
          </div>

          <h2 className="text-base font-semibold text-[#1f2328] dark:text-[#f0f6fc]">
            {mode === "signup" ? "Create student account" : "Sign in to your account"}
          </h2>
          <p className="text-xs text-[#656d76] dark:text-[#8d96a0] mt-1">
            {mode === "signup"
              ? "Register to track test results and persist solutions across sessions."
              : "Sign in with your student credentials to restore your progress."}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-[#f6f8fa] dark:bg-[#0d1117] p-0.5 rounded border border-[#d0d7de] dark:border-[#30363d] mt-4">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                mode === "login"
                  ? "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d]"
                  : "text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                mode === "signup"
                  ? "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d]"
                  : "text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]"
              }`}
            >
              Create account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-3 p-2.5 rounded bg-[#cf222e]/5 dark:bg-[#f85149]/10 border border-[#cf222e]/20 dark:border-[#f85149]/20 text-[#cf222e] dark:text-[#f85149] text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {mode === "signup" && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-medium text-[#1f2328] dark:text-[#f0f6fc] mb-1">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[#656d76] dark:text-[#8d96a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded text-xs text-[#1f2328] dark:text-[#f0f6fc] placeholder-[#656d76]/60 dark:placeholder-[#8d96a0]/60 focus:outline-none focus:border-[#0969da] dark:focus:border-[#58a6ff] transition-colors"
                    />
                  </div>
                </div>

                {/* Student ID & College Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#1f2328] dark:text-[#f0f6fc] mb-1">
                      Student ID
                    </label>
                    <div className="relative">
                      <IdCard className="w-3.5 h-3.5 text-[#656d76] dark:text-[#8d96a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="CS2026-042"
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded text-xs text-[#1f2328] dark:text-[#f0f6fc] placeholder-[#656d76]/60 dark:placeholder-[#8d96a0]/60 focus:outline-none focus:border-[#0969da] dark:focus:border-[#58a6ff] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#1f2328] dark:text-[#f0f6fc] mb-1">
                      College
                    </label>
                    <div className="relative">
                      <Building className="w-3.5 h-3.5 text-[#656d76] dark:text-[#8d96a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        placeholder="MIT"
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded text-xs text-[#1f2328] dark:text-[#f0f6fc] placeholder-[#656d76]/60 dark:placeholder-[#8d96a0]/60 focus:outline-none focus:border-[#0969da] dark:focus:border-[#58a6ff] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-[11px] font-medium text-[#1f2328] dark:text-[#f0f6fc] mb-1">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#656d76] dark:text-[#8d96a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded text-xs text-[#1f2328] dark:text-[#f0f6fc] placeholder-[#656d76]/60 dark:placeholder-[#8d96a0]/60 focus:outline-none focus:border-[#0969da] dark:focus:border-[#58a6ff] transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-medium text-[#1f2328] dark:text-[#f0f6fc] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#656d76] dark:text-[#8d96a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] rounded text-xs text-[#1f2328] dark:text-[#f0f6fc] placeholder-[#656d76]/60 dark:placeholder-[#8d96a0]/60 focus:outline-none focus:border-[#0969da] dark:focus:border-[#58a6ff] transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2 px-3 rounded bg-[#0969da] hover:bg-[#0854b0] disabled:opacity-50 text-white text-xs font-medium shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : mode === "signup" ? (
                <span>Register and start solving</span>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          {/* Footer toggle note */}
          <div className="mt-4 pt-3 border-t border-[#d0d7de] dark:border-[#30363d] text-center text-[11px] text-[#656d76] dark:text-[#8d96a0]">
            {mode === "signup" ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-[#0969da] dark:text-[#58a6ff] hover:underline font-medium"
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
                  className="text-[#0969da] dark:text-[#58a6ff] hover:underline font-medium"
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
