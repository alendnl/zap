"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Code2,
  Terminal,
  CheckCircle2,
  Loader2,
  LogOut,
  BookOpen,
  Circle,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  Users,
  Trophy,
  Clock,
  Layers,
  HelpCircle,
  Send,
  Check,
  X,
  Play,
  ArrowRight,
  RefreshCw,
  BarChart3,
  LayoutDashboard,
  Flame,
} from "lucide-react";
import { StudentWorkspace } from "@/components/StudentWorkspace";
import { VanillaCompiler } from "@/components/VanillaCompiler";
import { ContestArena } from "@/components/ContestArena";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { QuestionData } from "@/components/QuestionPane";
import { questionsApi } from "@/services/questionsApi";
import { contestApi } from "@/services/contestApi";
import { SubmissionSummary } from "@/services/submissionsApi";
import { activityApi } from "@/services/activityApi";
import { adminApi } from "@/services/adminApi";
import { ENVIRONMENT_CHANGE_EVENT } from "@/services/environment";
import { getStoredStudent, AUTH_CHANGE_EVENT, authApi } from "@/services/authApi";
import { StudentAuthView } from "@/components/StudentAuthView";
import type { Student } from "@/types/auth";
import type { Question, QuestionSummary } from "@/types/question";
import type { ContestSummary, ContestStartResponse } from "@/types/contest";
import {
  type NavigationTopic,
  isTabEnabled,
  DEFAULT_TAB,
} from "@/config/tabs";

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
  const [activeTab, setActiveTab] = useState<NavigationTopic>(DEFAULT_TAB);
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
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  // Filters & Search for DSA Questions
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
  const QUESTIONS_PER_PAGE = 10;

  // Contest Management & Session State
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loadingContests, setLoadingContests] = useState(false);
  const [activeContestOverview, setActiveContestOverview] = useState<ContestSummary | null>(null);
  const [loadingContestStart, setLoadingContestStart] = useState(false);
  const [activeContestSession, setActiveContestSession] = useState<ContestStartResponse | null>(null);
  const [contestSearch, setContestSearch] = useState("");
  const [contestPage, setContestPage] = useState(1);
  const CONTESTS_PER_PAGE = 10;

  const loadContestsList = useCallback(async () => {
    setLoadingContests(true);
    try {
      const data = await contestApi.list("PUBLISHED", true);
      setContests(data || []);
    } catch {
      setContests([]);
    } finally {
      setLoadingContests(false);
    }
  }, []);

  const handleStartContest = async (contestSlugOrId: string) => {
    setLoadingContestStart(true);
    try {
      const studentId = student?.id || (student as any)?._id || student?.studentId || "student-anonymous";
      const studentEmail = student?.email;
      const studentName = student?.name;
      const session = await contestApi.start(contestSlugOrId, studentId, studentEmail, studentName);
      setActiveContestSession(session);
      setActiveContestOverview(null);
    } catch (err: any) {
      alert(err.message || "Failed to initialize contest session. Please check backend connection.");
    } finally {
      setLoadingContestStart(false);
    }
  };

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
      if (tabParam && ["dsa", "basic", "compiler", "contest"].includes(tabParam)) {
        if (isTabEnabled(tabParam)) {
          setActiveTab(tabParam);
        } else {
          setActiveTab(DEFAULT_TAB);
          const url = new URL(window.location.href);
          url.searchParams.delete("tab");
          window.history.replaceState({}, "", url.toString());
        }
      } else {
        setActiveTab(DEFAULT_TAB);
      }
      const problemParam = urlParams.get("problem") || urlParams.get("id");
      if (problemParam) {
        setIntendedProblem(problemParam);
      }
      const contestParam = urlParams.get("contest");
      if (contestParam) {
        setActiveTab("contest");
        void contestApi.get(contestParam).then((c) => {
          if (c) {
            setActiveContestOverview({
              id: c.id,
              title: c.title,
              slug: c.slug,
              description: c.description,
              durationMinutes: c.durationMinutes,
              hasMcq: c.hasMcq,
              hasCoding: c.hasCoding,
              mcqQuestionsCount: c.mcqConfig?.totalQuestions ?? 0,
              codingQuestionsCount: c.codingConfig?.totalQuestions ?? 0,
              totalPoints: c.totalPoints,
              status: c.status,
              createdAt: c.createdAt || new Date().toISOString(),
              updatedAt: c.updatedAt || new Date().toISOString(),
            });
          }
        }).catch(() => {});
      }
    }
    void loadContestsList();
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

  // Check if current user is likely an admin (heuristic + persistent cache)
  const isLikelyAdmin = useCallback((s?: Student | null) => {
    if (!s?.email) return false;
    const clean = s.email.toLowerCase().trim();
    return (
      clean === "alendnl@gmail.com" ||
      clean.includes("admin") ||
      (s as any)?.role === "admin" ||
      (s as any)?.isAdmin === true ||
      clean === "admin@codezap.in"
    );
  }, []);

  // Check if current user is an admin
  useEffect(() => {
    if (!student?.email) {
      setIsAdmin(false);
      return;
    }

    // Fast-path: optimistic check from heuristic or localStorage cache to prevent button flickering
    const cachedAdmin = typeof window !== "undefined" && localStorage.getItem("zap_is_admin") === "true";
    if (cachedAdmin || isLikelyAdmin(student)) {
      setIsAdmin(true);
    }

    let isCurrent = true;
    adminApi
      .checkAdmin(student.email)
      .then((allowed) => {
        if (!isCurrent) return;
        setIsAdmin(allowed);
        if (typeof window !== "undefined") {
          localStorage.setItem("zap_is_admin", String(allowed));
        }
      })
      .catch(() => {
        if (!isCurrent) return;
        if (!isLikelyAdmin(student)) {
          setIsAdmin(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [student, isLikelyAdmin]);

  // Click outside and Escape key handler for admin dropdown
  useEffect(() => {
    if (!adminDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      if (
        adminDropdownRef.current &&
        !adminDropdownRef.current.contains(event.target as Node)
      ) {
        setAdminDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdminDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [adminDropdownOpen]);

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
    if (!isTabEnabled(newTab)) return;
    setActiveTab(newTab);
    setSearchQuery("");
    setDifficultyFilter("ALL");
    setSelectedTag(null);
    if (newTab === "contest") {
      void loadContestsList();
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", newTab);
      window.history.pushState({}, "", url.toString());
    }
  };

  // Guard against disabled active tab
  useEffect(() => {
    if (!isTabEnabled(activeTab)) {
      setActiveTab(DEFAULT_TAB);
    }
  }, [activeTab]);

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

  // Reset pagination to page 1 whenever filters or tabs change
  useEffect(() => {
    setQuestionPage(1);
  }, [searchQuery, difficultyFilter, selectedTag, activeTab]);

  const totalQuestionPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  const safeQuestionPage = Math.min(questionPage, totalQuestionPages);

  const paginatedQuestions = useMemo(() => {
    const start = (safeQuestionPage - 1) * QUESTIONS_PER_PAGE;
    return filteredQuestions.slice(start, start + QUESTIONS_PER_PAGE);
  }, [filteredQuestions, safeQuestionPage]);

  // Filtered and paginated contests
  const filteredContests = useMemo(() => {
    if (!contestSearch.trim()) return contests;
    const term = contestSearch.toLowerCase().trim();
    return contests.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term)
    );
  }, [contests, contestSearch]);

  useEffect(() => {
    setContestPage(1);
  }, [contestSearch]);

  const totalContestPages = Math.max(1, Math.ceil(filteredContests.length / CONTESTS_PER_PAGE));
  const safeContestPage = Math.min(contestPage, totalContestPages);

  const paginatedContests = useMemo(() => {
    const start = (safeContestPage - 1) * CONTESTS_PER_PAGE;
    return filteredContests.slice(start, start + CONTESTS_PER_PAGE);
  }, [filteredContests, safeContestPage]);

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

  // 3b. Authenticated: Render ContestArena if active contest session is running
  if (activeContestSession) {
    return (
      <ContestArena
        contest={activeContestSession.contest}
        mcqQuestions={activeContestSession.mcqQuestions}
        codingQuestions={activeContestSession.codingQuestions}
        studentId={student.id || (student as any)?._id || student.studentId}
        studentEmail={student.email}
        studentName={student.name}
        initialSession={activeContestSession}
        onExit={() => {
          setActiveContestSession(null);
          void loadContestsList();
        }}
      />
    );
  }

  return (
    <div
      className={`bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-200 ${activeTab === "compiler" ? "h-screen overflow-hidden" : "min-h-screen"
        }`}
    >
      {/* Top Workbench Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] flex-shrink-0 shadow-xs">
        <div
          className={`mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4 ${activeTab === "compiler" ? "w-full" : "max-w-6xl"
            }`}
        >
          {/* Brand & Section Switcher */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shadow-blue-600/30">
                Z
              </span>
              <div className="hidden xs:flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight select-none text-[#0f172a] dark:text-white">
                  ZAP
                </span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Arena
                </span>
              </div>
            </div>

            {/* Segmented Topic Navigation (Responsive scroll on mobile) */}
            <nav className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] overflow-x-auto no-scrollbar max-w-full">
              {isTabEnabled("dsa") && (
                <button
                  type="button"
                  onClick={() => handleTabSwitch("dsa")}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex-shrink-0 ${activeTab === "dsa"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                >
                  <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span>DSA<span className="hidden sm:inline"> Problems</span></span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]">
                    {dsaQuestions.length}
                  </span>
                </button>
              )}

              {isTabEnabled("basic") && (
                <button
                  type="button"
                  onClick={() => handleTabSwitch("basic")}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex-shrink-0 ${activeTab === "basic"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                  <span><span className="hidden md:inline">Basic </span>Concepts</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]">
                    {basicQuestions.length}
                  </span>
                </button>
              )}

              {isTabEnabled("compiler") && (
                <button
                  type="button"
                  onClick={() => handleTabSwitch("compiler")}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex-shrink-0 ${activeTab === "compiler"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <span>Compiler</span>
                </button>
              )}

              {isTabEnabled("contest") && (
                <button
                  type="button"
                  onClick={() => handleTabSwitch("contest")}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer flex-shrink-0 ${activeTab === "contest"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  <span>Contests</span>
                  {contests.length > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]">
                      {contests.length}
                    </span>
                  )}
                </button>
              )}
            </nav>

            {/* Admin Hub Direct Gateway & Operations Dropdown */}
            {isAdmin && (
              <div ref={adminDropdownRef} className="relative flex-shrink-0 inline-flex items-center">
                <div className="inline-flex items-center rounded-lg bg-purple-500/10 hover:bg-purple-500/15 border border-purple-500/30 text-purple-700 dark:text-purple-300 shadow-xs transition-colors">
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold hover:text-purple-900 dark:hover:text-purple-100 transition-colors"
                    title="Open Admin Hub"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                    <span>Admin</span>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAdminDropdownOpen((prev) => !prev);
                    }}
                    aria-label="Toggle admin dropdown menu"
                    aria-expanded={adminDropdownOpen}
                    title="Quick navigation"
                    className="px-1.5 py-1.5 hover:bg-purple-500/20 border-l border-purple-500/20 rounded-r-lg transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-purple-600 dark:text-purple-400 transition-transform duration-150 ${
                        adminDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {adminDropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
                  >
                    {/* Overview Header */}
                    <Link
                      href="/admin"
                      onClick={() => setAdminDropdownOpen(false)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <LayoutDashboard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span>Admin Overview Hub</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    {/* Section 1: Dashboards */}
                    <div className="space-y-0.5">
                      <div className="px-2 pt-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center justify-between">
                        <span>Dashboards</span>
                        <span className="text-[9px] font-sans font-normal text-blue-500">Analytics</span>
                      </div>

                      <Link
                        href="/admin/users"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white transition-colors"
                      >
                        <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">User Dashboard</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Student & college metrics</span>
                        </div>
                      </Link>

                      <Link
                        href="/admin/contests/analytics"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white transition-colors"
                      >
                        <BarChart3 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">Contest Dashboard</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Evaluations & proctoring</span>
                        </div>
                      </Link>
                    </div>

                    {/* Section 2: Studio */}
                    <div className="space-y-0.5 border-t border-[#f1f5f9] dark:border-[#1a2233] pt-1.5">
                      <div className="px-2 pt-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center justify-between">
                        <span>Studio</span>
                        <span className="text-[9px] font-sans font-normal text-indigo-500">Authoring</span>
                      </div>

                      <Link
                        href="/admin/questions"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white transition-colors"
                      >
                        <Code2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">Coding Questions</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Challenges & test cases</span>
                        </div>
                      </Link>

                      <Link
                        href="/admin/mcq"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white transition-colors"
                      >
                        <HelpCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">MCQs</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Multiple choice database</span>
                        </div>
                      </Link>

                      <Link
                        href="/admin/contests"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white transition-colors"
                      >
                        <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs">Contests</span>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Assessments & scheduling</span>
                        </div>
                      </Link>
                    </div>

                    {/* Section 3: Operations */}
                    <div className="space-y-0.5 border-t border-[#f1f5f9] dark:border-[#1a2233] pt-1.5">
                      <div className="px-2 pt-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center justify-between">
                        <span>Operations</span>
                        <span className="text-[9px] font-sans font-normal text-rose-500">Performance</span>
                      </div>

                      <Link
                        href="/admin/load-test"
                        onClick={() => setAdminDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white transition-colors group"
                      >
                        <Flame className="w-4 h-4 text-rose-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs">Load Testing Studio</span>
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">QA Only</span>
                          </div>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Simulate API & compiler traffic</span>
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Tools: Session, Environment, Theme */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {student && (
              <div className="hidden lg:flex items-center gap-2 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs shadow-xs">
                <span className="w-4 h-4 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center">
                  {student.name.charAt(0).toUpperCase()}
                </span>
                <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white truncate max-w-[120px]">
                  {student.name}
                </span>
                <span className="text-[#94a3b8] text-[10px] font-mono hidden xl:inline">
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
            )}

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* 1. DSA PROBLEMS TAB & 2. BASIC PROGRAMMING TAB */}
        {((activeTab === "dsa" && isTabEnabled("dsa")) || (activeTab === "basic" && isTabEnabled("basic"))) && (
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
                  <div className="flex items-center gap-4 sm:gap-5 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 sm:p-4 rounded-2xl shadow-xs dark:shadow-black/20 w-full lg:w-auto min-w-0 sm:min-w-[280px]">
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
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${isSelected
                          ? "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                          : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                        }`}
                    >
                      <span>{diff === "ALL" ? "All" : diff.charAt(0) + diff.slice(1).toLowerCase()}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${isSelected
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
                  className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all flex-shrink-0 cursor-pointer ${selectedTag === null
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
                    className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all flex-shrink-0 border cursor-pointer ${selectedTag === tag
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
                {/* Table Header (Desktop/Tablet) */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
                  <div className="col-span-1">Status</div>
                  <div className="col-span-6 md:col-span-7">Problem Title</div>
                  <div className="col-span-2">Difficulty</div>
                  <div className="hidden md:block col-span-1 text-right font-mono">Test Cases</div>
                  <div className="col-span-3 md:col-span-1 text-right">Action</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                  {paginatedQuestions.map((q) => {
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
                        className="hover:bg-[#f1f5f9]/70 dark:hover:bg-[#1a2233]/60 transition-all cursor-pointer group text-xs"
                      >
                        {/* Desktop / Tablet Grid Row */}
                        <div className="hidden sm:grid grid-cols-12 gap-3 px-5 py-3.5 items-center">
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
                              <div className="flex items-center gap-1.5 mt-1 overflow-hidden flex-wrap">
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
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${isSolved
                                  ? "border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                                  : "border-blue-600 dark:border-blue-500 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xs shadow-blue-600/25"
                                }`}
                            >
                              {isOpening ? "Loading" : isSolved ? "Review" : "Solve →"}
                            </button>
                          </div>
                        </div>

                        {/* Mobile Stacked Card (Clean, Unsquished, Responsive) */}
                        <div className="sm:hidden p-4 space-y-2.5">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              {isSolved ? (
                                <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                  <CheckCircle2 className="w-3.5 h-3.5" aria-label="Solved" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-[#f1f5f9] dark:bg-[#161e2e] border border-dashed border-[#cbd5e1] dark:border-[#334155] flex items-center justify-center text-[#94a3b8] flex-shrink-0">
                                  <Circle className="w-2.5 h-2.5 text-[#94a3b8]" aria-label="Not solved" />
                                </div>
                              )}
                              <span className="font-semibold text-sm text-[#0f172a] dark:text-white truncate">
                                {q.title}
                              </span>
                            </div>
                            <span
                              className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${diffConfig.className}`}
                            >
                              {diffConfig.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#f1f5f9] dark:border-[#1a2233]">
                            <div className="flex items-center gap-1.5 overflow-hidden flex-wrap flex-1 min-w-0">
                              {q.tags && q.tags.length > 0 ? (
                                q.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag}
                                    className="text-[9px] text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#161e2e] px-1.5 py-0.5 rounded-md border border-[#e2e8f0] dark:border-[#1e293b] font-medium"
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-[#94a3b8]">DSA Algorithm</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openQuestion(q.id);
                              }}
                              disabled={isOpening}
                              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border cursor-pointer flex-shrink-0 ${isSolved
                                  ? "border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8]"
                                  : "border-blue-600 bg-blue-600 text-white shadow-2xs"
                                }`}
                            >
                              {isOpening ? "Loading" : isSolved ? "Review" : "Solve →"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pagination Controls for Problems Catalog */}
            {filteredQuestions.length > 0 && totalQuestionPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Showing <strong className="text-[#0f172a] dark:text-white">{(safeQuestionPage - 1) * QUESTIONS_PER_PAGE + 1}</strong> to{" "}
                  <strong className="text-[#0f172a] dark:text-white">{Math.min(safeQuestionPage * QUESTIONS_PER_PAGE, filteredQuestions.length)}</strong> of{" "}
                  <strong className="text-[#0f172a] dark:text-white">{filteredQuestions.length}</strong> problems
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuestionPage((p) => Math.max(1, p - 1))}
                    disabled={safeQuestionPage <= 1}
                    className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-all cursor-pointer shadow-xs"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1 px-2.5 text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                    <span>Page</span>
                    <strong className="text-[#0f172a] dark:text-white">{safeQuestionPage}</strong>
                    <span>of</span>
                    <strong className="text-[#0f172a] dark:text-white">{totalQuestionPages}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestionPage((p) => Math.min(totalQuestionPages, p + 1))}
                    disabled={safeQuestionPage >= totalQuestionPages}
                    className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-all cursor-pointer shadow-xs"
                  >
                    Next
                  </button>
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
        {activeTab === "compiler" && isTabEnabled("compiler") && (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <VanillaCompiler />
          </div>
        )}

        {/* 4. CONTESTS TAB */}
        {activeTab === "contest" && isTabEnabled("contest") && (
          <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-8">
            {/* High-Impact Hero Banner */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50 text-[11px] font-semibold text-amber-700 dark:text-amber-300 shadow-xs">
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span className="tracking-wide uppercase font-mono text-[10px]">
                    Competitive Assessment Arena
                  </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
                  Contests & Technical Assessments
                </h1>

                <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] max-w-2xl leading-relaxed">
                  Timed comprehensive evaluations, campus placement test simulations, and multi-format benchmarks combining conceptual multiple-choice questions with hands-on algorithm judge challenges.
                </p>
              </div>

              {/* Assessment Metrics Card */}
              <div className="flex items-center gap-4 sm:gap-5 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 sm:p-4 rounded-2xl shadow-xs w-full lg:w-auto min-w-0 sm:min-w-[260px]">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold font-mono text-[#0f172a] dark:text-white tracking-tight">
                      {contests.length}
                    </span>
                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">
                      Available
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
                    Assessment Modules
                  </span>
                </div>

                <div className="flex-1 flex flex-col gap-1 text-right text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                  <span>Status: Active</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Judge Live
                  </span>
                </div>
              </div>
            </div>

            {/* Contests Explorer List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                  All Active Contests ({contests.length})
                </span>
                <button
                  type="button"
                  onClick={() => void loadContestsList()}
                  disabled={loadingContests}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingContests ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {loadingContests ? (
                <div className="py-20 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Loading contests...
                </div>
              ) : contests.length === 0 ? (
                <div className="py-20 text-center bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-8 space-y-3">
                  <Trophy className="w-8 h-8 text-[#94a3b8] mx-auto" />
                  <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">
                    No Published Contests Found
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-sm mx-auto">
                    Check back shortly or visit the Contest Studio if you are an administrator.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-5">
                    {paginatedContests.map((c) => (
                      <div
                        key={c.id}
                        className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                      >
                        <div className="space-y-3 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono uppercase tracking-wide">
                              {c.status}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold font-mono">
                              {c.durationMinutes} Minutes
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-bold font-mono">
                              {c.totalPoints} Total Points
                            </span>
                          </div>

                          <div>
                            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] dark:text-white tracking-tight">
                              {c.title}
                            </h2>
                            <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1 leading-relaxed">
                              {c.description}
                            </p>
                          </div>

                          {/* Structure breakdown tags */}
                          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                            {c.hasMcq && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-[#334155] dark:text-[#cbd5e1] font-medium">
                                <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                <span>{c.mcqQuestionsCount} Multiple Choice Questions</span>
                              </span>
                            )}

                            {c.hasCoding && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-[#334155] dark:text-[#cbd5e1] font-medium">
                                <Code2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>{c.codingQuestionsCount} Algorithm Coding Challenges</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Primary CTA Button */}
                        <div className="shrink-0 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveContestOverview(c)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 cursor-pointer transition-transform active:scale-98"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>View Structure & Enter</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalContestPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b]">
                      <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        Showing <strong className="text-[#0f172a] dark:text-white">{(safeContestPage - 1) * CONTESTS_PER_PAGE + 1}</strong> to{" "}
                        <strong className="text-[#0f172a] dark:text-white">{Math.min(safeContestPage * CONTESTS_PER_PAGE, filteredContests.length)}</strong> of{" "}
                        <strong className="text-[#0f172a] dark:text-white">{filteredContests.length}</strong> contests
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setContestPage((p) => Math.max(1, p - 1))}
                          disabled={safeContestPage <= 1}
                          className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-all cursor-pointer shadow-xs"
                        >
                          Previous
                        </button>
                        <div className="flex items-center gap-1 px-2.5 text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                          <span>Page</span>
                          <strong className="text-[#0f172a] dark:text-white">{safeContestPage}</strong>
                          <span>of</span>
                          <strong className="text-[#0f172a] dark:text-white">{totalContestPages}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => setContestPage((p) => Math.min(totalContestPages, p + 1))}
                          disabled={safeContestPage >= totalContestPages}
                          className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-all cursor-pointer shadow-xs"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contest Structure & Start Modal */}
            {activeContestOverview && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-6 animate-in fade-in-50 zoom-in-95">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-bold uppercase">
                        Assessment Blueprint
                      </div>
                      <h3 className="text-lg font-bold text-[#0f172a] dark:text-white">
                        {activeContestOverview.title}
                      </h3>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        Duration: <strong className="text-[#0f172a] dark:text-white">{activeContestOverview.durationMinutes} Minutes</strong> · Total Points: <strong className="text-[#0f172a] dark:text-white">{activeContestOverview.totalPoints} pts</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveContestOverview(null)}
                      className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sections Breakdown Cards */}
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                      Included Sections:
                    </span>

                    {activeContestOverview.hasMcq && (
                      <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                            Section 1: Conceptual Multiple Choice Questions
                          </h4>
                          <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                            {activeContestOverview.mcqQuestionsCount} questions covering core computer science subjects. Jump between questions anytime with the top Q1–Q{activeContestOverview.mcqQuestionsCount} palette.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeContestOverview.hasCoding && (
                      <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Code2 className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                            Section 2: Hands-on Algorithm Challenges
                          </h4>
                          <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                            {activeContestOverview.codingQuestionsCount} problems embedded directly in the full Monaco judge compiler. Write, debug against public testcases, and submit code across C, C++, Java, Python, and JavaScript.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rules Checklist */}
                  <div className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-xs space-y-1.5 text-[#64748b] dark:text-[#94a3b8]">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Timer starts automatically once you click "Start Assessment".</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Answers are auto-saved locally during the assessment session.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span>Final score and full question explanations revealed post-submission.</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveContestOverview(null)}
                      className="px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={loadingContestStart}
                      onClick={() => handleStartContest(activeContestOverview.slug || activeContestOverview.id)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
                    >
                      {loadingContestStart ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Preparing Workspace...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Assessment Now</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
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
