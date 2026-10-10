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
  LogOut,
  BookOpen,
  Play,
  Laptop,
  Cpu,
  FileCode,
} from "lucide-react";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import { VanillaCompiler } from "@/components/VanillaCompiler";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { QuestionData } from "@/components/QuestionPane";
import { questionsApi } from "@/services/questionsApi";
import { submissionsApi } from "@/services/submissionsApi";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ENVIRONMENT_CHANGE_EVENT } from "@/services/environment";
import { getStoredStudent, AUTH_CHANGE_EVENT, authApi } from "@/services/authApi";
import { StudentAuthView } from "@/components/StudentAuthView";
import type { Student } from "@/types/auth";
import type { Question, QuestionSummary, Difficulty } from "@/types/question";

type NavigationTopic = "dsa" | "basic" | "compiler";

const DIFFICULTY_CONFIG: Record<
  string,
  { label: string; text: string; bg: string; border: string; pill: string }
> = {
  EASY: {
    label: "Easy",
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    border: "border-emerald-500/30",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  MEDIUM: {
    label: "Medium",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    border: "border-amber-500/30",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  HARD: {
    label: "Hard",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    border: "border-rose-500/30",
    pill: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
};

const BASIC_PROGRAMMING_MODULES = [
  {
    title: "Variables, Data Types & I/O",
    desc: "Understand standard input & output, primitives, type casting, and arithmetic operations.",
    tag: "Fundamentals",
    badge: "Module 1",
    examples: ["Print formatted strings", "Read integer & string from stdin", "Calculate sum & averages"],
  },
  {
    title: "Conditionals & Decision Making",
    desc: "Master if-else logic, comparison operators, and multi-branch decision structures.",
    tag: "Control Flow",
    badge: "Module 2",
    examples: ["Odd or Even Checker", "Find Largest of Three Numbers", "Leap Year Evaluator"],
  },
  {
    title: "Loops, Iterations & Patterns",
    desc: "Work with while, for, and nested loops to generate number series and star patterns.",
    tag: "Iterations",
    badge: "Module 3",
    examples: ["Factorial & Multiplication Table", "Pyramid Star Pattern", "Reverse an Integer"],
  },
  {
    title: "Functions & Recursion",
    desc: "Structure code into modular functions with return values, arguments, and base cases.",
    tag: "Functions",
    badge: "Module 4",
    examples: ["Prime Number Checker Function", "GCD using Euclidean Algorithm", "Fibonacci Sequence"],
  },
  {
    title: "Arrays & String Traversal",
    desc: "Inspect array indices, sequential searches, reversals, and character frequency counting.",
    tag: "Data Basics",
    badge: "Module 5",
    examples: ["Find Min & Max in Array", "Palindrome String Verification", "Count Vowels & Consonants"],
  },
  {
    title: "Math & Logic Puzzles",
    desc: "Solve classical logic puzzles, bitwise tricks, and mathematical divisibility rules.",
    tag: "Logic",
    badge: "Module 6",
    examples: ["Armstrong Number Checker", "Sum of Digits", "Bitwise Odd/Even & Swaps"],
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavigationTopic>("dsa");
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProblemId, setLoadingProblemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Student Authentication Gate
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [intendedProblem, setIntendedProblem] = useState<string | null>(null);
  const [solvedQuestionIds, setSolvedQuestionIds] = useState<Set<string>>(new Set());

  // Filters & Search for DSA Questions
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadUserSolvedStatus = useCallback(async () => {
    const curStudent = getStoredStudent();
    if (!curStudent) {
      setSolvedQuestionIds(new Set());
      return;
    }
    try {
      const subs = await submissionsApi.list({
        userId: curStudent.studentId,
        mode: "SUBMIT",
        limit: 100,
      });
      const solved = new Set<string>();
      (subs || []).forEach((s) => {
        if (s.verdict === "ACCEPTED") {
          solved.add(s.questionId);
        }
      });
      setSolvedQuestionIds(solved);
    } catch (err) {
      console.error("Failed to load user solved status", err);
    }
  }, []);

  // Check stored session & URL query params on mount
  useEffect(() => {
    const stored = getStoredStudent();
    setStudent(stored);
    setIsAuthInitializing(false);

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get("tab") as NavigationTopic | null;
      if (tabParam && ["dsa", "basic", "compiler"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
      const problemParam = urlParams.get("problem") || urlParams.get("id");
      if (problemParam) {
        setIntendedProblem(problemParam);
      }
    }
  }, []);

  // Sync auth state across tabs and logouts
  useEffect(() => {
    const handleAuthChange = () => {
      const current = getStoredStudent();
      setStudent(current);
      if (!current) {
        setSelectedQuestion(null);
        setSolvedQuestionIds(new Set());
      } else {
        void loadUserSolvedStatus();
      }
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  }, [loadUserSolvedStatus]);

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

  const loadQuestionList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const list = await questionsApi.list("PUBLISHED", true);
      setQuestions(list || []);

      // If user came with a problem link and is authenticated, open it
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
  }, [openQuestion]);

  const handleBackToCatalog = useCallback(() => {
    setSelectedQuestion(null);
    setIntendedProblem(null);
    void loadUserSolvedStatus();
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("problem");
      url.searchParams.delete("id");
      window.history.pushState({}, "", url.toString());
    }
  }, [loadUserSolvedStatus]);

  const handleTabSwitch = (newTab: NavigationTopic) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.pushState({}, "", url.toString());
    }
  };

  useEffect(() => {
    if (student) {
      void loadQuestionList();
      void loadUserSolvedStatus();
    }
    window.addEventListener(ENVIRONMENT_CHANGE_EVENT, loadQuestionList);
    return () => {
      window.removeEventListener(ENVIRONMENT_CHANGE_EVENT, loadQuestionList);
    };
  }, [student, loadQuestionList, loadUserSolvedStatus]);

  // Filter out internal non-question entries like "vanilla-compiler"
  const dsaQuestions = useMemo(() => {
    return questions.filter((q) => q.slug !== "vanilla-compiler");
  }, [questions]);

  // Unique tags for filter pills
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    dsaQuestions.forEach((q) => {
      q.tags?.forEach((t) => tagsSet.add(t));
    });
    return Array.from(tagsSet);
  }, [dsaQuestions]);

  // Filtered DSA questions
  const filteredQuestions = useMemo(() => {
    return dsaQuestions.filter((q) => {
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
  }, [dsaQuestions, searchQuery, difficultyFilter, selectedTag]);

  // Solved Count
  const solvedCount = useMemo(() => {
    return dsaQuestions.filter(
      (q) => solvedQuestionIds.has(q.id) || solvedQuestionIds.has(q.slug)
    ).length;
  }, [dsaQuestions, solvedQuestionIds]);

  // Difficulty counts
  const difficultyCounts = useMemo(() => {
    const counts = { ALL: dsaQuestions.length, EASY: 0, MEDIUM: 0, HARD: 0 };
    dsaQuestions.forEach((q) => {
      if (q.difficulty in counts) {
        counts[q.difficulty as "EASY" | "MEDIUM" | "HARD"]++;
      }
    });
    return counts;
  }, [dsaQuestions]);

  // 1. Initializing auth state from localStorage
  if (isAuthInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-500 dark:text-sky-400 font-black text-xl animate-pulse">
            Z
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Initializing ZAP Arena…</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Gate: Show Student Sign In / Sign Up
  if (!student) {
    return (
      <StudentAuthView
        intendedProblemSlug={intendedProblem}
        onSuccess={(authenticatedStudent) => {
          setStudent(authenticatedStudent);
          if (intendedProblem) {
            void openQuestion(intendedProblem);
          }
        }}
      />
    );
  }

  // 3. Authenticated: Render StudentWorkspace if problem is open
  if (selectedQuestion) {
    return (
      <StudentWorkspace
        question={selectedQuestion}
        onBackToCatalog={handleBackToCatalog}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080c16] text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Centralized Header Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600 dark:text-sky-400 font-black text-sm">
                Z
              </div>
              <span className="text-sky-600 dark:text-sky-400 font-black text-lg tracking-tight select-none">
                ZAP
              </span>
            </div>

            {/* Central Segmented Topic Selector */}
            <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => handleTabSwitch("dsa")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "dsa"
                    ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>DSA Problems</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {dsaQuestions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("basic")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "basic"
                    ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Basic Programming</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                  Track
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("compiler")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "compiler"
                    ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Vanilla Compiler</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  5 Langs
                </span>
              </button>
            </nav>
          </div>

          {/* Right Action Icons: Profile, Environment, Theme Toggle */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 px-2.5 py-1 rounded-xl text-xs">
              <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center text-xs">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs leading-tight">
                  {student.name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {student.studentId} · {student.collegeName}
                </span>
              </div>
              <button
                onClick={() => authApi.logout()}
                title="Sign Out"
                type="button"
                className="ml-1.5 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <EnvironmentSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area based on Active Tab */}
      <div className="flex-1 flex flex-col">
        {/* 1. DSA PROBLEMS TAB */}
        {activeTab === "dsa" && (
          <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
            {/* Hero Section */}
            <div className="mb-8">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Interview Preparation Track</span>
                </div>
                {dsaQuestions.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Solved {solvedCount} / {dsaQuestions.length} Challenges
                    </span>
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                DSA & Algorithmic Challenges
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Test your algorithmic skills with preloaded problems. Review test cases, submit your solution, and receive immediate verdict evaluations across all 5 languages.
              </p>
            </div>

            {/* Search & Filters Bar */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search challenges by title, slug, or tag..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Difficulty Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 flex-shrink-0">
                {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((diff) => {
                  const isSelected = difficultyFilter === diff;
                  const count = difficultyCounts[diff];
                  return (
                    <button
                      key={diff}
                      onClick={() => setDifficultyFilter(diff)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-700"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <span>{diff === "ALL" ? "All" : diff.charAt(0) + diff.slice(1).toLowerCase()}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected
                            ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500"
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
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
                        ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {/* Error Notice */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => void loadQuestionList()}
                  className="underline hover:no-underline font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Questions Table */}
            {loadingList ? (
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-12 text-center shadow-sm">
                <Loader2 className="w-6 h-6 animate-spin text-sky-500 mx-auto mb-3" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading problems catalog...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-12 text-center shadow-sm">
                <Code2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No challenges matched your filter</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Try adjusting your search keywords, clearing tags, or switching difficulty filter to ALL.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/70 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5 md:col-span-6">Title & Topics</div>
                  <div className="col-span-2">Difficulty</div>
                  <div className="hidden md:block col-span-2">Test Cases</div>
                  <div className="col-span-4 md:col-span-1 text-right">Action</div>
                </div>

                {/* Question Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredQuestions.map((q, idx) => {
                    const diffConfig = DIFFICULTY_CONFIG[q.difficulty] || DIFFICULTY_CONFIG.EASY;
                    const isOpening = loadingProblemId === q.id || loadingProblemId === q.slug;
                    const isSolved = solvedQuestionIds.has(q.id) || solvedQuestionIds.has(q.slug);

                    return (
                      <div
                        key={q.id}
                        onClick={() => !isOpening && void openQuestion(q.id)}
                        className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      >
                        {/* Index */}
                        <div className="col-span-1 text-xs font-mono text-slate-400 dark:text-slate-500">
                          {idx + 1}
                        </div>

                        {/* Title & Tags */}
                        <div className="col-span-5 md:col-span-6 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            {isSolved && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                            )}
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
                              {q.title}
                            </span>
                          </div>
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                              {q.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {q.tags.length > 3 && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
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
                        <div className="hidden md:block col-span-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
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
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs disabled:opacity-50 ${
                              isSolved
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                : "bg-sky-600 hover:bg-sky-500 text-white"
                            }`}
                          >
                            {isOpening ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isSolved ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Solved</span>
                              </>
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
        )}

        {/* 2. BASIC PROGRAMMING TAB */}
        {activeTab === "basic" && (
          <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
            {/* Track Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold mb-3">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Foundations & Syntax Track</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Basic Programming Curriculum
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                Build rock-solid problem solving foundations. Practice loops, nested conditions, functions, pattern printing, and array manipulations across C, C++, Java, Python, and JavaScript.
              </p>
            </div>

            {/* Preparation Banner Notice */}
            <div className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-500/20 dark:border-sky-500/30 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Basic Programming Challenges Track
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl leading-relaxed">
                    Custom beginner exercises are ready to be populated. You can also jump straight into the Vanilla Compiler playground to write and run any basic code in all 5 languages right now.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTabSwitch("compiler")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all whitespace-nowrap active:scale-[0.98]"
              >
                <Terminal className="w-4 h-4" />
                <span>Open Vanilla Compiler</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Curriculum Module Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {BASIC_PROGRAMMING_MODULES.map((mod, i) => (
                <div
                  key={mod.title}
                  className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {mod.badge}
                      </span>
                      <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                        #{mod.tag}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                      {mod.desc}
                    </p>

                    <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                        Core Exercises:
                      </span>
                      {mod.examples.map((ex) => (
                        <div
                          key={ex}
                          className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 flex-shrink-0" />
                          <span className="truncate">{ex}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">Coming next</span>
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("compiler")}
                      className="text-sky-600 dark:text-sky-400 hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>Try in Compiler</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* 3. VANILLA COMPILER TAB */}
        {activeTab === "compiler" && (
          <div className="flex-1 w-full" style={{ height: "calc(100vh - 3.5rem)" }}>
            <VanillaCompiler />
          </div>
        )}
      </div>
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
