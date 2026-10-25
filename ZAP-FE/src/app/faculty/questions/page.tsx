"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { questionsApi } from "@/services/questionsApi";
import type { QuestionSummary } from "@/types/question";
import { Plus, ArrowLeft, Trash2, Edit3, Code2 } from "lucide-react";

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "text-[#047857] dark:text-[#34d399] bg-[#ecfdf5] dark:bg-[#10b981]/15 border-[#a7f3d0] dark:border-[#10b981]/25",
  MEDIUM: "text-[#b45309] dark:text-[#fbbf24] bg-[#fffbeb] dark:bg-[#f59e0b]/15 border-[#fde68a] dark:border-[#f59e0b]/25",
  HARD: "text-[#b91c1c] dark:text-[#fb7185] bg-[#fef2f2] dark:bg-[#f43f5e]/15 border-[#fecaca] dark:border-[#f43f5e]/25",
};

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
  DRAFT: "text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#1a2233] border-[#e2e8f0] dark:border-[#232f45]",
  ARCHIVED: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
};

export default function FacultyDashboard() {
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    questionsApi
      .list()
      .then(setQuestions)
      .catch((err: unknown) => {
        setError(err instanceof Error ? `Could not load questions: ${err.message}` : "Could not load questions.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this question?")) return;
    try {
      await questionsApi.delete(id);
      setQuestions((qs) => qs.filter((q) => q.id !== id));
    } catch {
      setError("Delete failed — using mock data so backend is required.");
      setQuestions((qs) => qs.filter((q) => q.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white/90 dark:bg-[#121824]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-xs shadow-blue-600/25">
              Z
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[#0f172a] dark:text-white font-bold text-sm tracking-tight">ZAP</span>
              <span className="text-[#64748b] dark:text-[#94a3b8] text-xs font-semibold">Faculty Portal</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <EnvironmentSwitcher />
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] px-3 py-1.5 rounded-xl transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </Link>
            <Link
              href="/faculty/questions/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-xs shadow-blue-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Question</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0f172a] dark:text-white">Question Bank</h1>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">Manage and curate coding challenges for student evaluations</p>
          </div>
          {loading && <span className="text-xs text-[#64748b] dark:text-[#94a3b8] animate-pulse">Loading…</span>}
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-blue-500/30 transition-all group shadow-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${DIFFICULTY_BADGE[q.difficulty] || DIFFICULTY_BADGE["MEDIUM"]}`}>
                    {q.difficulty}
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_BADGE[q.status] || STATUS_BADGE["DRAFT"]}`}>
                    {q.status}
                  </span>
                  {q.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[11px] text-[#64748b] dark:text-[#94a3b8] bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] px-2 py-0.5 rounded-md font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-sm font-bold text-[#0f172a] dark:text-white truncate">{q.title}</h2>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                  v{q.version} · {q.testCasesCount ?? 0} test cases · {(q.supportedLanguages ?? []).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/faculty/questions/${q.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#f8fafc] dark:bg-[#1a2233] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] border border-[#e2e8f0] dark:border-[#232f45] text-[#0f172a] dark:text-white text-xs font-semibold rounded-lg transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}

          {questions.length === 0 && !loading && (
            <div className="text-center py-20 text-[#64748b] dark:text-[#94a3b8]">
              <Code2 className="w-10 h-10 mx-auto mb-3 opacity-40 text-blue-500" />
              <p className="mb-4 text-xs font-semibold">No questions in the question bank yet.</p>
              <Link
                href="/faculty/questions/new"
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create your first question</span>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
