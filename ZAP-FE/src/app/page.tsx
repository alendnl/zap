"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  Code2,
  Terminal,
  CheckCircle2,
  Layers,
  Loader2,
  LogOut,
  BookOpen,
  Circle,
  ExternalLink,
} from "lucide-react";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import { VanillaCompiler } from "@/components/VanillaCompiler";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { QuestionData } from "@/components/QuestionPane";
import { questionsApi } from "@/services/questionsApi";
import { submissionsApi, Submission } from "@/services/submissionsApi";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ENVIRONMENT_CHANGE_EVENT } from "@/services/environment";
import { getStoredStudent, AUTH_CHANGE_EVENT, authApi } from "@/services/authApi";
import { StudentAuthView } from "@/components/StudentAuthView";
import type { Student } from "@/types/auth";
import type { Question, QuestionSummary } from "@/types/question";

type NavigationTopic = "dsa" | "basic" | "compiler";

const DIFFICULTY_BADGES: Record<
  string,
  { label: string; className: string }
> = {
  EASY: {
    label: "Easy",
    className:
      "text-[#1a7f37] dark:text-[#3fb950] bg-[#dafbe1] dark:bg-[#2ea043]/15 border-[#1a7f37]/20 dark:border-[#3fb950]/30",
  },
  MEDIUM: {
    label: "Medium",
    className:
      "text-[#9a6700] dark:text-[#d29922] bg-[#fff8c5] dark:bg-[#bb8009]/15 border-[#9a6700]/20 dark:border-[#d29922]/30",
  },
  HARD: {
    label: "Hard",
    className:
      "text-[#cf222e] dark:text-[#f85149] bg-[#ffebe9] dark:bg-[#f85149]/15 border-[#cf222e]/20 dark:border-[#f85149]/30",
  },
};

const BASIC_CONCEPTS = [
  {
    title: "Input, output, and types",
    summary: "Standard I/O streams, primitive types, numeric representations, and type casting.",
    topics: ["Formatted output and format specifiers", "Reading single and multi-token input", "Type casting and precision handling"],
  },
  {
    title: "Conditionals and branching",
    summary: "Control flow decisions, relational comparisons, boolean algebra, and switch structures.",
    topics: ["Multi-condition branching with if-else", "Logical short-circuit evaluations", "Switch-case jump structures"],
  },
  {
    title: "Loops and iterations",
    summary: "Definite and indefinite iteration, loop invariants, nested iterations, and break control.",
    topics: ["While and for loop mechanics", "Nested loops for matrix traversals", "Break, continue, and early exits"],
  },
  {
    title: "Functions and recursion",
    summary: "Modular decomposition, pass-by-value vs reference, call stacks, and base cases.",
    topics: ["Function signatures and return contracts", "Stack frames and local variable scope", "Single and tree recursion base cases"],
  },
  {
    title: "Arrays and strings",
    summary: "Contiguous memory allocations, indexing, buffer bounds, and character arrays.",
    topics: ["In-place traversals and linear scans", "String terminator handling and length", "Two-pointer reversals and bounds"],
  },
  {
    title: "Arithmetic and number logic",
    summary: "Modular arithmetic, greatest common divisor algorithms, prime checking, and bit operations.",
    topics: ["Euclidean algorithm for GCD", "Primality testing up to square root of N", "Digit extraction and bitwise shifts"],
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<NavigationTopic>("dsa");
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null);
  const [initialSubmissions, setInitialSubmissions] = useState<Submission[] | undefined>(undefined);
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
      const curStudent = getStoredStudent();

      // Launch question fetch and submissions fetch concurrently in parallel
      const questionPromise = questionsApi.get(questionIdOrSlug);
      const submissionsPromise = curStudent
        ? submissionsApi
            .list({
              questionId: questionIdOrSlug,
              userId: curStudent.studentId,
              limit: 100,
            })
            .catch(() => [])
        : Promise.resolve([]);

      const [fullQuestion, submissionsList] = await Promise.all([
        questionPromise,
        submissionsPromise,
      ]);

      let finalSubmissions = submissionsList;
      if (
        curStudent &&
        finalSubmissions.length === 0 &&
        fullQuestion.id !== questionIdOrSlug
      ) {
        finalSubmissions = await submissionsApi
          .list({
            questionId: fullQuestion.id,
            userId: curStudent.studentId,
            limit: 100,
          })
          .catch(() => []);
      }

      setInitialSubmissions(finalSubmissions);
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
    setInitialSubmissions(undefined);
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

  // Exclude internal playground questions like "vanilla-compiler"
  const dsaQuestions = useMemo(() => {
    return questions.filter((q) => q.slug !== "vanilla-compiler");
  }, [questions]);

  // Unique tags
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
      <div className="min-h-screen bg-[#f6f8fa] dark:bg-[#0d1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-[#0969da] text-white font-mono text-xs font-bold flex items-center justify-center animate-pulse">
            Z
          </div>
          <p className="text-xs text-[#656d76] dark:text-[#8b949e]">Loading workspace...</p>
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
        initialSubmissions={initialSubmissions}
      />
    );
  }

  return (
    <div
      className={`bg-[#f6f8fa] dark:bg-[#0d1117] text-[#1f2328] dark:text-[#e6edf3] flex flex-col ${
        activeTab === "compiler" ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* Top Workbench Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] flex-shrink-0">
        <div
          className={`mx-auto px-4 h-12 flex items-center justify-between gap-4 ${
            activeTab === "compiler" ? "w-full" : "max-w-6xl"
          }`}
        >
          {/* Brand & Section Switcher */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-[#0969da] dark:bg-[#2f81f7] text-white flex items-center justify-center font-mono font-bold text-[11px] select-none">
                Z
              </span>
              <span className="font-semibold text-sm tracking-tight select-none">
                ZAP
              </span>
            </div>

            {/* Segmented Topic Navigation */}
            <nav className="flex items-center gap-1 bg-[#f3f4f6] dark:bg-[#0b0e14] p-0.5 rounded-md border border-[#d0d7de] dark:border-[#30363d]">
              <button
                type="button"
                onClick={() => handleTabSwitch("dsa")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                  activeTab === "dsa"
                    ? "bg-white dark:bg-[#161b22] text-[#1f2328] dark:text-[#e6edf3] font-semibold shadow-xs"
                    : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                }`}
              >
                <span>DSA problems</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-[#e1e4e8] dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e]">
                  {dsaQuestions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("basic")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                  activeTab === "basic"
                    ? "bg-white dark:bg-[#161b22] text-[#1f2328] dark:text-[#e6edf3] font-semibold shadow-xs"
                    : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                }`}
              >
                <span>Basic programming</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("compiler")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors ${
                  activeTab === "compiler"
                    ? "bg-white dark:bg-[#161b22] text-[#1f2328] dark:text-[#e6edf3] font-semibold shadow-xs"
                    : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                }`}
              >
                <span>Compiler</span>
              </button>
            </nav>
          </div>

          {/* Right Tools: Session, Environment, Theme */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] px-2.5 py-1 rounded-md text-xs">
              <span className="w-4 h-4 rounded-full bg-[#0969da]/15 text-[#0969da] dark:text-[#2f81f7] text-[10px] font-bold flex items-center justify-center">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium text-[11px] text-[#1f2328] dark:text-[#e6edf3] truncate max-w-[140px]">
                {student.name}
              </span>
              <span className="text-[#8c959f] text-[10px] font-mono">
                {student.studentId}
              </span>
              <button
                type="button"
                onClick={() => authApi.logout()}
                title="Sign out"
                className="ml-1 text-[#656d76] dark:text-[#8b949e] hover:text-[#cf222e] dark:hover:text-[#f85149] p-0.5"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>

            <EnvironmentSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* 1. DSA PROBLEMS TAB */}
        {activeTab === "dsa" && (
          <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
            {/* Header Description */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#d0d7de] dark:border-[#30363d]">
              <div>
                <h1 className="text-lg font-semibold text-[#1f2328] dark:text-[#e6edf3] tracking-tight">
                  Data structures and algorithms
                </h1>
                <p className="mt-0.5 text-xs text-[#656d76] dark:text-[#8b949e] max-w-2xl">
                  Curated interview problems with custom test suites and isolated execution across C, C++, Java, Python, and JavaScript.
                </p>
              </div>

              {dsaQuestions.length > 0 && (
                <div className="text-xs font-mono text-[#656d76] dark:text-[#8b949e]">
                  Progress: {solvedCount} of {dsaQuestions.length} solved
                </div>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between mb-4">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-[#8c959f] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title, slug, or tag..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-md text-xs text-[#1f2328] dark:text-[#e6edf3] placeholder-[#8c959f] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Difficulty Segment Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#161b22] p-0.5 rounded-md border border-[#d0d7de] dark:border-[#30363d] text-xs">
                {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((diff) => {
                  const isSelected = difficultyFilter === diff;
                  const count = difficultyCounts[diff];
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficultyFilter(diff)}
                      className={`px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                        isSelected
                          ? "bg-[#f3f4f6] dark:bg-[#21262d] text-[#1f2328] dark:text-[#e6edf3] font-semibold"
                          : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328]"
                      }`}
                    >
                      <span>{diff === "ALL" ? "All" : diff.charAt(0) + diff.slice(1).toLowerCase()}</span>
                      <span className="text-[10px] font-mono text-[#8c959f]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags Strip */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 text-xs scrollbar-thin">
                <span className="text-[11px] text-[#656d76] dark:text-[#8b949e] mr-1 flex-shrink-0">
                  Topics:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors flex-shrink-0 ${
                    selectedTag === null
                      ? "bg-[#0969da]/10 dark:bg-[#2f81f7]/15 text-[#0969da] dark:text-[#2f81f7] font-medium"
                      : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-2 py-0.5 rounded text-[11px] transition-colors flex-shrink-0 border ${
                      selectedTag === tag
                        ? "border-[#0969da]/30 bg-[#0969da]/10 text-[#0969da] dark:text-[#2f81f7] font-medium"
                        : "border-transparent text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Error Notice */}
            {error && (
              <div className="mb-4 p-3 rounded-md bg-[#ffebe9] dark:bg-[#f85149]/10 border border-[#cf222e]/30 text-[#cf222e] dark:text-[#f85149] text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => void loadQuestionList()}
                  className="font-medium hover:underline ml-2"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Questions Table */}
            {loadingList ? (
              <div className="border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] rounded-md p-8 text-center text-xs text-[#656d76] dark:text-[#8b949e]">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0969da]" />
                <span>Loading problems catalog...</span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] rounded-md p-8 text-center text-xs text-[#656d76] dark:text-[#8b949e]">
                <span>No problems match the current filter.</span>
              </div>
            ) : (
              <div className="border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] rounded-md overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] text-[11px] font-semibold text-[#656d76] dark:text-[#8b949e]">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-6 md:col-span-7">Title</div>
                  <div className="col-span-2">Difficulty</div>
                  <div className="hidden md:block col-span-1 text-right font-mono">Tests</div>
                  <div className="col-span-3 md:col-span-1 text-right">Action</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-[#d0d7de]/60 dark:divide-[#30363d]/60">
                  {filteredQuestions.map((q) => {
                    const diffConfig =
                      DIFFICULTY_BADGES[q.difficulty] || DIFFICULTY_BADGES.EASY;
                    const isOpening =
                      loadingProblemId === q.id || loadingProblemId === q.slug;
                    const isSolved =
                      solvedQuestionIds.has(q.id) || solvedQuestionIds.has(q.slug);

                    return (
                      <div
                        key={q.id}
                        onClick={() => !isOpening && void openQuestion(q.id)}
                        className="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-[#f6f8fa]/80 dark:hover:bg-[#21262d]/50 transition-colors cursor-pointer group text-xs"
                      >
                        {/* Status */}
                        <div className="col-span-1">
                          {isSolved ? (
                            <CheckCircle2
                              className="w-4 h-4 text-[#1a7f37] dark:text-[#3fb950]"
                              aria-label="Solved"
                            />
                          ) : (
                            <Circle
                              className="w-4 h-4 text-[#d0d7de] dark:text-[#30363d]"
                              aria-label="Not solved"
                            />
                          )}
                        </div>

                        {/* Title and Tags */}
                        <div className="col-span-6 md:col-span-7 min-w-0 pr-2">
                          <div className="font-medium text-[#1f2328] dark:text-[#e6edf3] group-hover:text-[#0969da] dark:group-hover:text-[#2f81f7] transition-colors truncate">
                            {q.title}
                          </div>
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
                              {q.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] text-[#656d76] dark:text-[#8b949e]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Difficulty */}
                        <div className="col-span-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${diffConfig.className}`}
                          >
                            {diffConfig.label}
                          </span>
                        </div>

                        {/* Test Cases Count */}
                        <div className="hidden md:block col-span-1 text-right text-[11px] font-mono text-[#656d76] dark:text-[#8b949e]">
                          {q.testCasesCount != null ? q.testCasesCount : "—"}
                        </div>

                        {/* Action */}
                        <div className="col-span-3 md:col-span-1 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openQuestion(q.id);
                            }}
                            disabled={isOpening}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                              isSolved
                                ? "border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328]"
                                : "border-[#0969da] dark:border-[#2f81f7] bg-[#0969da] dark:bg-[#2f81f7] text-white hover:opacity-90"
                            }`}
                          >
                            {isOpening ? "Loading" : isSolved ? "Review" : "Solve"}
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
          <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
            {/* Header Description */}
            <div className="mb-6 pb-4 border-b border-[#d0d7de] dark:border-[#30363d]">
              <h1 className="text-lg font-semibold text-[#1f2328] dark:text-[#e6edf3] tracking-tight">
                Basic programming concepts
              </h1>
              <p className="mt-0.5 text-xs text-[#656d76] dark:text-[#8b949e] max-w-2xl">
                Foundational programming exercises covering core language constructs, conditionals, loops, functions, and elementary arrays.
              </p>
            </div>

            {/* Information Notice */}
            <div className="border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] rounded-md p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#1f2328] dark:text-[#e6edf3]">
                  Question sets for this section are being prepared
                </p>
                <p className="text-xs text-[#656d76] dark:text-[#8b949e] mt-0.5">
                  You can test and run any basic code directly using the compiler in C, C++, Java, Python, or JavaScript.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleTabSwitch("compiler")}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#0969da] dark:bg-[#2f81f7] text-white hover:opacity-90 transition-opacity flex-shrink-0"
              >
                Open compiler
              </button>
            </div>

            {/* Concepts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {BASIC_CONCEPTS.map((concept) => (
                <div
                  key={concept.title}
                  className="border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] rounded-md p-4 flex flex-col justify-between"
                >
                  <div>
                    <h2 className="text-sm font-semibold text-[#1f2328] dark:text-[#e6edf3]">
                      {concept.title}
                    </h2>
                    <p className="text-xs text-[#656d76] dark:text-[#8b949e] mt-1 leading-relaxed">
                      {concept.summary}
                    </p>

                    <div className="mt-3 pt-3 border-t border-[#d0d7de]/60 dark:border-[#30363d]/60 space-y-1">
                      {concept.topics.map((t) => (
                        <div
                          key={t}
                          className="text-[11px] text-[#1f2328] dark:text-[#c9d1d9] flex items-center gap-1.5"
                        >
                          <span className="w-1 h-1 rounded-full bg-[#8c959f] flex-shrink-0" />
                          <span className="truncate">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-[#d0d7de]/60 dark:border-[#30363d]/60 flex items-center justify-between">
                    <span className="text-[11px] text-[#8c959f]">Coming in next prompt</span>
                    <button
                      type="button"
                      onClick={() => handleTabSwitch("compiler")}
                      className="text-[11px] text-[#0969da] dark:text-[#2f81f7] hover:underline font-medium"
                    >
                      Test in compiler
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* 3. COMPILER TAB */}
        {activeTab === "compiler" && (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
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
