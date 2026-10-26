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
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Users,
} from "lucide-react";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import { VanillaCompiler } from "@/components/VanillaCompiler";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { QuestionData } from "@/components/QuestionPane";
import { questionsApi } from "@/services/questionsApi";
import { SubmissionSummary } from "@/services/submissionsApi";
import { activityApi } from "@/services/activityApi";
import { adminApi } from "@/services/adminApi";
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
      "text-[#047857] dark:text-[#34d399] bg-[#ecfdf5] dark:bg-[#10b981]/15 border-[#a7f3d0] dark:border-[#10b981]/25",
  },
  MEDIUM: {
    label: "Medium",
    className:
      "text-[#b45309] dark:text-[#fbbf24] bg-[#fffbeb] dark:bg-[#f59e0b]/15 border-[#fde68a] dark:border-[#f59e0b]/25",
  },
  HARD: {
    label: "Hard",
    className:
      "text-[#b91c1c] dark:text-[#fb7185] bg-[#fef2f2] dark:bg-[#f43f5e]/15 border-[#fecaca] dark:border-[#f43f5e]/25",
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
  const [initialSubmissions, setInitialSubmissions] = useState<SubmissionSummary[] | undefined>(undefined);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingProblemId, setLoadingProblemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Student Authentication Gate
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [intendedProblem, setIntendedProblem] = useState<string | null>(null);
  const [solvedQuestionIds, setSolvedQuestionIds] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  // Filters & Search for DSA Questions
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const loadUserSolvedStatus = useCallback(async () => {
    const userIdent = student?.id || (student as any)?._id || student?.email;
    if (!userIdent) {
      setSolvedQuestionIds(new Set());
      return;
    }
    try {
      const summary = await activityApi.getSummary(userIdent);
      if (summary?.solvedQuestionIds) {
        setSolvedQuestionIds(new Set(summary.solvedQuestionIds));
      }
    } catch (err) {
      // Graceful fallback if offline or backend unavailable
      setSolvedQuestionIds(new Set());
    }
  }, [student]);

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
      }
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  }, []);

  // Check if current user is an admin
  useEffect(() => {
    if (student?.email) {
      adminApi.checkAdmin(student.email).then(setIsAdmin).catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [student]);

  const openQuestion = useCallback(async (questionIdOrSlug: string) => {
    setLoadingProblemId(questionIdOrSlug);
    try {
      // Only fetch question details. Submissions are only loaded when user opens the Submissions tab.
      const fullQuestion = await questionsApi.get(questionIdOrSlug);
      setInitialSubmissions(undefined);
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
    setSearchQuery("");
    setDifficultyFilter("ALL");
    setSelectedTag(null);
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

  // Separate questions into DSA problems and Basic Programming problems
  const dsaQuestions = useMemo(() => {
    return questions.filter(
      (q) => q.slug !== "vanilla-compiler" && !q.tags?.includes("basic-programming")
    );
  }, [questions]);

  const basicQuestions = useMemo(() => {
    return questions.filter(
      (q) => q.slug !== "vanilla-compiler" && q.tags?.includes("basic-programming")
    );
  }, [questions]);

  const currentTopicQuestions = useMemo(() => {
    if (activeTab === "basic") return basicQuestions;
    return dsaQuestions;
  }, [activeTab, basicQuestions, dsaQuestions]);

  // Unique tags for current active topic
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    currentTopicQuestions.forEach((q) => {
      q.tags?.forEach((t) => {
        if (t !== "basic-programming") tagsSet.add(t);
      });
    });
    return Array.from(tagsSet);
  }, [currentTopicQuestions]);

  // Filtered questions for current active topic
  const filteredQuestions = useMemo(() => {
    return currentTopicQuestions.filter((q) => {
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
  }, [currentTopicQuestions, searchQuery, difficultyFilter, selectedTag]);

  // Solved Count for current active topic
  const solvedCount = useMemo(() => {
    return currentTopicQuestions.filter(
      (q) => solvedQuestionIds.has(q.id) || solvedQuestionIds.has(q.slug)
    ).length;
  }, [currentTopicQuestions, solvedQuestionIds]);

  // Difficulty counts for current active topic
  const difficultyCounts = useMemo(() => {
    const counts = { ALL: currentTopicQuestions.length, EASY: 0, MEDIUM: 0, HARD: 0 };
    currentTopicQuestions.forEach((q) => {
      if (q.difficulty in counts) {
        counts[q.difficulty as "EASY" | "MEDIUM" | "HARD"]++;
      }
    });
    return counts;
  }, [currentTopicQuestions]);

  // 1. Initializing auth state from localStorage
  if (isAuthInitializing) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center animate-pulse shadow-xs shadow-blue-600/25">
            Z
          </div>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Loading workspace...</p>
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
      className={`bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-200 ${
        activeTab === "compiler" ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* Top Workbench Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] flex-shrink-0 shadow-xs">
        <div
          className={`mx-auto px-4 h-13 flex items-center justify-between gap-4 ${
            activeTab === "compiler" ? "w-full" : "max-w-6xl"
          }`}
        >
          {/* Brand & Section Switcher */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shadow-blue-600/30">
                Z
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight select-none text-[#0f172a] dark:text-white">
                  ZAP
                </span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Arena
                </span>
              </div>
            </div>

            {/* Segmented Topic Navigation */}
            <nav className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <button
                type="button"
                onClick={() => handleTabSwitch("dsa")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === "dsa"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>DSA Problems</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]">
                  {dsaQuestions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("basic")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === "basic"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Basic Programming</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]">
                  {basicQuestions.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabSwitch("compiler")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  activeTab === "compiler"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Compiler</span>
              </button>

              {isAdmin && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAdminDropdownOpen((prev) => !prev)}
                    onMouseEnter={() => setAdminDropdownOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-semibold shadow-xs"
                    title="Admin Portal"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Admin</span>
                    <ChevronDown
                      className={`w-3 h-3 text-purple-600 dark:text-purple-400 transition-transform ${
                        adminDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {adminDropdownOpen && (
                    <div
                      onMouseLeave={() => setAdminDropdownOpen(false)}
                      className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl shadow-lg p-1.5 z-50 flex flex-col gap-1 text-xs"
                    >
                      <Link
                        href="/admin/users"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">Users Dashboard</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Student & college metrics</span>
                        </div>
                      </Link>
                      <Link
                        href="/faculty/questions"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#64748b] dark:text-[#94a3b8] transition-colors"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <div className="flex flex-col">
                          <span className="font-medium text-xs">Questions Manager</span>
                          <span className="text-[10px] text-[#94a3b8]">Create & edit problems</span>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </nav>
          </div>

          {/* Right Tools: Session, Environment, Theme */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs shadow-xs">
              <span className="w-4 h-4 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white truncate max-w-[140px]">
                {student.name}
              </span>
              <span className="text-[#94a3b8] text-[10px] font-mono">
                {student.studentId}
              </span>
              <button
                type="button"
                onClick={() => authApi.logout()}
                title="Sign out"
                className="ml-1 text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <EnvironmentSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* 1. DSA PROBLEMS TAB & 2. BASIC PROGRAMMING TAB */}
        {(activeTab === "dsa" || activeTab === "basic") && (
          <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
            {/* High-Impact Hero Banner & Live Progress Card */}
            <div className="mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 text-[11px] font-semibold text-blue-700 dark:text-blue-300 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="tracking-wide uppercase font-mono text-[10px]">
                      {activeTab === "dsa" ? "Competitive Programming Arena" : "Infosys SE Screening Module"}
                    </span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
                    {activeTab === "dsa"
                      ? "Technical Problem Explorer"
                      : "Basic Programming Concepts"}
                  </h1>

                  <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] max-w-2xl leading-relaxed">
                    {activeTab === "dsa"
                      ? "Curated algorithms and data structures with isolated multi-language compilers across C, C++, Java, Python, and JavaScript."
                      : "17 essential Infosys SE interview problems covering recursion, arithmetic logic, number properties, strings, and elementary arrays."}
                  </p>
                </div>

                {/* Progress & Solved Ratio Card */}
                {currentTopicQuestions.length > 0 && (
                  <div className="flex items-center gap-5 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs dark:shadow-black/20 min-w-[280px]">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-[#0f172a] dark:text-white tracking-tight">
                          {solvedCount}
                        </span>
                        <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">
                          / {currentTopicQuestions.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
                        Problems Solved
                      </span>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex justify-between text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                        <span>Completion</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {Math.round((solvedCount / Math.max(1, currentTopicQuestions.length)) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#f1f5f9] dark:bg-[#0b0f17] rounded-full overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b]">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-xs shadow-emerald-500/25"
                          style={{
                            width: `${Math.round((solvedCount / Math.max(1, currentTopicQuestions.length)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-4">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problems by name, tag, or slug..."
                  className="w-full pl-9 pr-14 py-2 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-xs"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  >
                    Clear
                  </button>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#94a3b8] font-mono pointer-events-none">
                    Filter
                  </span>
                )}
              </div>

              {/* Difficulty Segment Filter */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#121824] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs shadow-xs">
                {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((diff) => {
                  const isSelected = difficultyFilter === diff;
                  const count = difficultyCounts[diff];
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficultyFilter(diff)}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                          : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                      }`}
                    >
                      <span>{diff === "ALL" ? "All" : diff.charAt(0) + diff.slice(1).toLowerCase()}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                          isSelected
                            ? "bg-white dark:bg-[#0b0f17] text-[#0f172a] dark:text-white"
                            : "bg-[#f1f5f9] dark:bg-[#161e2e] text-[#64748b] dark:text-[#94a3b8]"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topics Horizontal Pills Strip */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-4 text-xs scrollbar-thin">
                <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mr-1 flex-shrink-0">
                  Topics:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all flex-shrink-0 cursor-pointer ${
                    selectedTag === null
                      ? "bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/20"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b]"
                  }`}
                >
                  All Topics
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all flex-shrink-0 border cursor-pointer ${
                      selectedTag === tag
                        ? "border-blue-600 bg-blue-600 text-white font-semibold shadow-xs shadow-blue-600/20"
                        : "border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-[#121824]"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {/* Error Notice */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => void loadQuestionList()}
                  className="font-semibold hover:underline ml-2"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Questions Table Container */}
            {loadingList ? (
              <div className="border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] rounded-2xl p-12 text-center text-xs text-[#64748b] dark:text-[#94a3b8] shadow-xs">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2.5 text-blue-600 dark:text-blue-400" />
                <span className="font-medium">Loading problems catalog...</span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] rounded-2xl p-12 text-center text-xs text-[#64748b] dark:text-[#94a3b8] shadow-xs">
                <span className="font-medium">No problems match the current filter.</span>
              </div>
            ) : (
              <div className="border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] rounded-2xl overflow-hidden shadow-xs">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-6 md:col-span-7">Problem Title</div>
                  <div className="col-span-2">Difficulty</div>
                  <div className="hidden md:block col-span-1 text-right font-mono">Test Cases</div>
                  <div className="col-span-3 md:col-span-1 text-right">Action</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
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
                        className="grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-[#f1f5f9]/70 dark:hover:bg-[#1a2233]/60 transition-all cursor-pointer group text-xs"
                      >
                        {/* Status Icon */}
                        <div className="col-span-1">
                          {isSolved ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" aria-label="Solved" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#f1f5f9] dark:bg-[#161e2e] border border-dashed border-[#cbd5e1] dark:border-[#334155] flex items-center justify-center text-[#94a3b8]">
                              <Circle className="w-3 h-3 text-[#94a3b8]" aria-label="Not solved" />
                            </div>
                          )}
                        </div>

                        {/* Title and Tags */}
                        <div className="col-span-6 md:col-span-7 min-w-0 pr-3">
                          <div className="font-semibold text-sm text-[#0f172a] dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {q.title}
                          </div>
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 overflow-hidden flex-wrap">
                              {q.tags
                                .filter((t) => t !== "basic-programming")
                                .slice(0, 4)
                                .map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[10px] text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#161e2e] px-2 py-0.5 rounded-md border border-[#e2e8f0] dark:border-[#1e293b] font-medium"
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
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${diffConfig.className}`}
                          >
                            {diffConfig.label}
                          </span>
                        </div>

                        {/* Test Cases Count */}
                        <div className="hidden md:block col-span-1 text-right text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
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
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                              isSolved
                                ? "border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                                : "border-blue-600 dark:border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs shadow-blue-600/25"
                            }`}
                          >
                            {isOpening ? "Loading" : isSolved ? "Review" : "Solve →"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Concepts Grid for Basic Programming Tab */}
            {activeTab === "basic" && (
              <div className="mt-12 pt-8 border-t border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/50 text-[11px] font-semibold text-blue-700 dark:text-blue-300 mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Curriculum Overview</span>
                  </div>
                  <h2 className="text-lg font-bold text-[#0f172a] dark:text-white tracking-tight">
                    Foundational Programming Concepts
                  </h2>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                    Core computer science building blocks tested in technical and system engineer screening interviews.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {BASIC_CONCEPTS.map((concept) => (
                    <div
                      key={concept.title}
                      className="border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:border-blue-500/40 hover:shadow-sm transition-all group"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-[#0f172a] dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {concept.title}
                        </h3>
                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1.5 leading-relaxed">
                          {concept.summary}
                        </p>

                        <div className="mt-4 pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] space-y-2">
                          {concept.topics.map((t) => (
                            <div
                              key={t}
                              className="text-[11px] text-[#475569] dark:text-[#94a3b8] flex items-center gap-2"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                              <span className="truncate">{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-5 pt-3.5 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between">
                        <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Practice sandbox</span>
                        <button
                          type="button"
                          onClick={() => handleTabSwitch("compiler")}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold cursor-pointer inline-flex items-center gap-1"
                        >
                          <span>Open in compiler</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
