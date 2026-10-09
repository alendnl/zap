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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />

        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-bold text-xs">
              Z
            </div>
            <span className="text-xs font-bold text-sky-400 uppercase tracking-widest">
              ZAP Student Portal
            </span>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight mt-1">
            {mode === "signup" ? "Create Student Account" : "Welcome Back, Student"}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === "signup"
              ? "Register to track your algorithmic coding challenges and practice."
              : "Sign in with your student credentials to continue practicing."}
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/80 mt-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === "login"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
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
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {mode === "signup" && (
              <>
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Student ID & College Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Student ID / Roll No
                    </label>
                    <div className="relative">
                      <IdCard className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="e.g. CS2026-042"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      College / University
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        placeholder="e.g. MIT"
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@college.edu"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-sky-600/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing…</span>
                </>
              ) : mode === "signup" ? (
                <span>Register & Start Solving</span>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer toggle note */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 text-center text-[11px] text-slate-500">
            {mode === "signup" ? (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-sky-400 hover:underline font-semibold"
                >
                  Sign In
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
                  className="text-sky-400 hover:underline font-semibold"
                >
                  Create an account
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
