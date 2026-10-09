"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { questionsApi } from "@/services/questionsApi";
import type { QuestionSummary } from "@/types/question";

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "text-emerald-400 bg-emerald-950/70 border-emerald-800/60",
  MEDIUM: "text-amber-400 bg-amber-950/70 border-amber-800/60",
  HARD: "text-rose-400 bg-rose-950/70 border-rose-800/60",
};

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "text-sky-400 bg-sky-950/60 border-sky-800/50",
  DRAFT: "text-slate-400 bg-slate-800/60 border-slate-700/50",
  ARCHIVED: "text-orange-400 bg-orange-950/60 border-orange-800/50",
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sky-400 font-black text-xl tracking-tight">ZAP</span>
            <span className="text-slate-500 text-sm">Faculty Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <EnvironmentSwitcher />
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded transition-colors"
            >
              ← Student Workspace
            </Link>
            <Link
              href="/faculty/questions/new"
              className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-4 py-1.5 rounded transition-colors"
            >
              + New Question
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Question Bank</h1>
          {loading && <span className="text-xs text-slate-500 animate-pulse">Loading…</span>}
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 bg-rose-950/50 border border-rose-800 rounded text-rose-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_BADGE[q.difficulty]}`}>
                    {q.difficulty}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[q.status]}`}>
                    {q.status}
                  </span>
                  {q.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-xs text-slate-500 bg-slate-800 border border-slate-700/60 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
                <h2 className="text-base font-semibold text-slate-100 truncate">{q.title}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  v{q.version} · {q.testCasesCount ?? 0} test cases · {(q.supportedLanguages ?? []).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/faculty/questions/${q.id}`}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(q.id)}
                  className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 text-xs font-medium rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {questions.length === 0 && !loading && (
            <div className="text-center py-20 text-slate-500">
              <p className="mb-3">No questions yet.</p>
              <Link
                href="/faculty/questions/new"
                className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold px-5 py-2 rounded"
              >
                Create your first question
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
