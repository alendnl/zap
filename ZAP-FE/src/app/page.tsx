"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Code2,
  Terminal,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle2,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import type { QuestionData } from "@/components/QuestionPane";
import { questionsApi } from "@/services/questionsApi";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ENVIRONMENT_CHANGE_EVENT } from "@/services/environment";
import type { Question, QuestionSummary, Difficulty } from "@/types/question";

const DIFFICULTY_CONFIG: Record<
  string,
  { label: string; text: string; bg: string; border: string; pill: string }
> = {
  EASY: {
    label: "Easy",
    text: "text-emerald-400",
    bg: "bg-emerald-950/60",
    border: "border-emerald-800/50",
    pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  MEDIUM: {
    label: "Medium",
    text: "text-amber-400",
    bg: "bg-amber-950/60",
    border: "border-amber-800/50",
    pill: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  HARD: {
    label: "Hard",
    text: "text-rose-400",
    bg: "bg-rose-950/60",
    border: "border-rose-800/50",
    pill: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  },
};

export default function Home() {
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProblemId, setLoadingProblemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadQuestionList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await questionsApi.list("PUBLISHED", true);
      setQuestions(list || []);

      // Check URL parameters for direct link to problem
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const problemParam = urlParams.get("problem") || urlParams.get("id");
        if (problemParam) {
          const match = (list || []).find(
            (q) => q.id === problemParam || q.slug === problemParam
          );
          if (match) {
            void openQuestion(match.id);
          }
        }
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load questions. Check your backend or environment setting."
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  const openQuestion = useCallback(async (questionIdOrSlug: string) => {
    setLoadingProblemId(questionIdOrSlug);
    try {
      const fullQuestion = await questionsApi.get(questionIdOrSlug);
      setSelectedQuestion(toQuestionData(fullQuestion));

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("problem", fullQuestion.slug);
        window.history.pushState({}, "", url.toString());
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? `Failed to load problem: ${err.message}`
          : "Failed to load problem details."
      );
    } finally {
      setLoadingProblemId(null);
    }
  }, []);

  const handleBackToCatalog = useCallback(() => {
    setSelectedQuestion(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("problem");
      url.searchParams.delete("id");
      window.history.pushState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    void loadQuestionList();
    window.addEventListener(ENVIRONMENT_CHANGE_EVENT, loadQuestionList);
    return () => {
      window.removeEventListener(ENVIRONMENT_CHANGE_EVENT, loadQuestionList);
    };
  }, [loadQuestionList]);

  // Unique tags for filter pills
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    questions.forEach((q) => {
      q.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [questions]);

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDifficulty =
        difficultyFilter === "ALL" || q.difficulty === difficultyFilter;

      const matchesTag =
        selectedTag === null || q.tags?.includes(selectedTag);

      return matchesSearch && matchesDifficulty && matchesTag;
    });
  }, [questions, searchQuery, difficultyFilter, selectedTag]);

  // Difficulty counts
  const difficultyCounts = useMemo(() => {
    const counts = { ALL: questions.length, EASY: 0, MEDIUM: 0, HARD: 0 };
    questions.forEach((q) => {
      if (q.difficulty in counts) {
        counts[q.difficulty as "EASY" | "MEDIUM" | "HARD"]++;
      }
    });
    return counts;
  }, [questions]);

  // If a question is actively open, render the StudentWorkspace
  if (selectedQuestion) {
    return (
      <StudentWorkspace
        question={selectedQuestion}
        onBackToCatalog={handleBackToCatalog}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 font-black text-sm">
                Z
              </div>
              <span className="text-sky-400 font-black text-lg tracking-tight select-none">
                ZAP
              </span>
            </div>
            <span className="text-slate-600 text-xs">|</span>
            <span className="text-xs font-semibold text-slate-300">
              Problem Catalog
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/faculty/questions"
              className="text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>Faculty Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <EnvironmentSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Interview Arena</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            DSA & Algorithmic Challenges
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 max-w-2xl leading-relaxed">
            Select a problem below to review the requirements, test your solution against custom test cases, and evaluate your code in isolated sandboxes.
          </p>
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 mb-6 backdrop-blur flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shadow-lg">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challenges by title, slug, or tag..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Difficulty Filter Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 flex-shrink-0">
            {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((diff) => {
              const isSelected = difficultyFilter === diff;
              const count = difficultyCounts[diff];
              return (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <span>{diff === "ALL" ? "All" : diff.charAt(0) + diff.slice(1).toLowerCase()}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? "bg-slate-700 text-slate-200"
                        : "bg-slate-850 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-thin">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
              <Filter className="w-3 h-3" />
              Tags:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                selectedTag === null
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              All Topics
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex-shrink-0 ${
                  selectedTag === tag
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => void loadQuestionList()}
              className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-900 border border-rose-700 rounded text-rose-200 font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Problem List Content */}
        {loadingList ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading problem catalog…</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="border border-slate-800/80 bg-slate-900/40 rounded-2xl p-12 text-center max-w-xl mx-auto mt-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <Code2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">
              {questions.length === 0
                ? "No published questions found"
                : "No matching challenges"}
            </h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {questions.length === 0
                ? "Create and publish questions in the Faculty Portal to begin practicing in this environment."
                : "Try adjusting your search query, difficulty filters, or topic tags to find challenges."}
            </p>
            {questions.length === 0 && (
              <Link
                href="/faculty/questions"
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <span>Open Faculty Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-950/40">
              <div className="col-span-1">#</div>
              <div className="col-span-5 md:col-span-6">Title</div>
              <div className="col-span-2">Difficulty</div>
              <div className="hidden md:block col-span-2">Tests</div>
              <div className="col-span-4 md:col-span-1 text-right">Action</div>
            </div>

            {/* Question Rows */}
            <div className="divide-y divide-slate-800/60">
              {filteredQuestions.map((q, idx) => {
                const diffConfig =
                  DIFFICULTY_CONFIG[q.difficulty] || DIFFICULTY_CONFIG.EASY;
                const isOpening = loadingProblemId === q.id;

                return (
                  <div
                    key={q.id}
                    onClick={() => !isOpening && void openQuestion(q.id)}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    {/* Index */}
                    <div className="col-span-1 text-xs font-mono text-slate-500">
                      {idx + 1}
                    </div>

                    {/* Title & Tags */}
                    <div className="col-span-5 md:col-span-6 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-200 group-hover:text-sky-400 transition-colors truncate">
                          {q.title}
                        </span>
                      </div>
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                          {q.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                          {q.tags.length > 3 && (
                            <span className="text-[10px] text-slate-500">
                              +{q.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Difficulty Badge */}
                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${diffConfig.text} ${diffConfig.bg} ${diffConfig.border}`}
                      >
                        {diffConfig.label}
                      </span>
                    </div>

                    {/* Test Cases Count */}
                    <div className="hidden md:block col-span-2 text-xs text-slate-400 font-medium">
                      {q.testCasesCount != null
                        ? `${q.testCasesCount} ${q.testCasesCount === 1 ? "case" : "cases"}`
                        : "Ready"}
                    </div>

                    {/* Action Button */}
                    <div className="col-span-4 md:col-span-1 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void openQuestion(q.id);
                        }}
                        disabled={isOpening}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 group-hover:bg-sky-500 text-white transition-all shadow-sm disabled:opacity-50"
                      >
                        {isOpening ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span>Solve</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function toQuestionData(question: Question): QuestionData {
  return {
    id: question.id,
    slug: question.slug,
    title: question.title,
    difficulty: question.difficulty,
    tags: question.tags,
    statement: question.statement,
    examples: question.examples ?? [],
    constraints: question.constraints,
    starterCode: question.starterCode,
  };
}
