"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Code2,
  BookOpen,
  Search,
  Filter,
  RefreshCw,
  X,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  Database,
  BarChart3,
  TrendingUp,
  Award,
  EyeOff,
  Lock,
  Check,
  FileCode,
  Copy,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Flame,
  PieChart,
  Info,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { getStoredStudent } from "@/services/authApi";
import { adminApi } from "@/services/adminApi";
import { contestApi } from "@/services/contestApi";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminHeader } from "@/components/AdminHeader";
import type { Student } from "@/types/auth";
import type {
  ContestAnalyticsResponse,
  ContestSummary,
  CandidateSubmissionItem,
  MCQReviewItem,
  CodingReviewItem,
} from "@/types/contest";

function ContestAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialContestSlug = searchParams.get("contest") || "";

  // Auth & Admin State
  const [student, setStudent] = useState<Student | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Contests List for Selector
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [selectedContestSlug, setSelectedContestSlug] = useState<string>(initialContestSlug);

  // Analytics Data State
  const [analytics, setAnalytics] = useState<ContestAnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // View state for Question Breakdown: "mcq" | "coding"
  const [questionBreakdownTab, setQuestionBreakdownTab] = useState<"mcq" | "coding">("mcq");

  // Candidate Submissions Filters, Search & Pagination
  const [candidateSearch, setCandidateSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUBMITTED" | "IN_PROGRESS">("ALL");
  const [integrityFilter, setIntegrityFilter] = useState<"ALL" | "CLEAN" | "FLAGGED">("ALL");
  const [sortBy, setSortBy] = useState<"rank_asc" | "score_desc" | "score_asc" | "infractions_desc" | "time_asc">("rank_asc");
  const [candidatePage, setCandidatePage] = useState(1);
  const CANDIDATES_PER_PAGE = 10;

  // Question Breakdown pagination (10 per page)
  const [mcqStatsPage, setMcqStatsPage] = useState(1);
  const [codingStatsPage, setCodingStatsPage] = useState(1);
  const STATS_PER_PAGE = 10;

  // Selected Student Drilldown Drawer & Single Candidate Loading
  const [inspectingStudent, setInspectingStudent] = useState<CandidateSubmissionItem | null>(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);
  const [studentDrawerTab, setStudentDrawerTab] = useState<"overview" | "proctoring" | "mcq" | "coding">("overview");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [resettingCandidateId, setResettingCandidateId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Check Admin Auth
  useEffect(() => {
    const currentStudent = getStoredStudent();
    setStudent(currentStudent);
    if (!currentStudent?.email) {
      setAuthLoading(false);
      setIsAdmin(false);
      return;
    }

    const cleanEmail = currentStudent.email.toLowerCase().trim();
    const isOwnerOrAdmin =
      cleanEmail === "alendnl@gmail.com" ||
      cleanEmail.includes("admin") ||
      (currentStudent as any)?.role === "admin" ||
      (typeof window !== "undefined" && localStorage.getItem("zap_is_admin") === "true");

    if (isOwnerOrAdmin) {
      setIsAdmin(true);
    }

    let isMounted = true;
    adminApi
      .checkAdmin(currentStudent.email)
      .then((allowed) => {
        if (!isMounted) return;
        setIsAdmin(allowed);
        setAuthLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        if (!isOwnerOrAdmin) {
          setIsAdmin(false);
        }
        setAuthLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Contests List for Selector
  const loadContestsList = useCallback(async () => {
    try {
      const list = await contestApi.list("ALL", true);
      setContests(list);
      if (!selectedContestSlug && list.length > 0) {
        setSelectedContestSlug(list[0].slug || list[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load contests list:", err);
    }
  }, [selectedContestSlug]);

  useEffect(() => {
    if (isAdmin) {
      void loadContestsList();
    }
  }, [isAdmin, loadContestsList]);

  // 3. Fetch Analytics for Selected Contest
  const loadAnalytics = useCallback(async () => {
    if (!selectedContestSlug) return;
    setLoadingAnalytics(true);
    setErrorNotice(null);
    try {
      const data = await contestApi.getAnalytics(selectedContestSlug);
      setAnalytics(data);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load contest analytics.");
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selectedContestSlug]);

  useEffect(() => {
    if (isAdmin && selectedContestSlug) {
      void loadAnalytics();
    }
  }, [isAdmin, selectedContestSlug, loadAnalytics]);

  // Handle Contest Selector Change
  const handleContestChange = (newSlug: string) => {
    setSelectedContestSlug(newSlug);
    setInspectingStudent(null);
    router.push(`/admin/contests/analytics?contest=${newSlug}`);
  };

  // Reset candidate contest data
  const handleResetCandidate = async (sub: CandidateSubmissionItem) => {
    const candidateName = sub.studentName || sub.studentEmail || sub.studentId || "Candidate";
    const identifier = sub.submissionId || sub.id || sub.studentId || sub.studentEmail;
    if (!identifier) return;

    const confirmed = confirm(
      `Are you sure you want to reset and delete contest data for "${candidateName}"?\n\n` +
      `This will permanently remove their scorecard, responses, and proctoring logs for this contest, allowing them to enter and take it again from scratch.`
    );
    if (!confirmed) return;

    setResettingCandidateId(identifier);
    setActionFeedback(null);
    try {
      const contestSlugOrId = analytics?.contest.slug || analytics?.contest.id || selectedContestSlug;
      await contestApi.resetCandidate(contestSlugOrId, identifier);
      setActionFeedback({
        type: "success",
        text: `Contest data for candidate "${candidateName}" was successfully reset.`,
      });
      if (inspectingStudent && (inspectingStudent.studentId === sub.studentId || inspectingStudent.id === sub.id)) {
        setInspectingStudent(null);
      }
      void loadAnalytics();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: err.message || `Failed to reset candidate contest data.`,
      });
    } finally {
      setResettingCandidateId(null);
    }
  };

  // Load single candidate drilldown on demand
  const handleInspectStudent = async (sub: CandidateSubmissionItem) => {
    const candidateId = sub.submissionId || sub.id || sub.studentId || sub.studentEmail;
    setStudentDrawerTab("overview");
    setInspectingStudent(sub);

    // If candidate report with coding breakdown or coding state is already present, no need to refetch
    if (sub.codingBreakdown && sub.codingBreakdown.length > 0 && sub.codingState) {
      return;
    }

    setLoadingStudentDetail(true);
    try {
      const contestSlugOrId = analytics?.contest.slug || analytics?.contest.id || selectedContestSlug;
      const fullSub = await contestApi.getCandidateSubmission(contestSlugOrId, candidateId);
      setInspectingStudent(fullSub);
    } catch (err: any) {
      console.error("Failed to load candidate detailed report:", err);
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  // Filtered & Sorted Candidate Submissions List
  const filteredSubmissions = useMemo(() => {
    if (!analytics?.submissions) return [];

    let list = [...analytics.submissions];

    // Search query
    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.studentEmail?.toLowerCase().includes(q) ||
          s.studentName?.toLowerCase().includes(q) ||
          s.studentId?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "ALL") {
      list = list.filter((s) => s.status === statusFilter);
    }

    // Integrity filter
    if (integrityFilter === "CLEAN") {
      list = list.filter((s) => {
        const p = s.proctoring;
        return !p || (p.tabSwitchCount === 0 && p.copyPasteAttempts === 0 && p.fullscreenExitCount === 0);
      });
    } else if (integrityFilter === "FLAGGED") {
      list = list.filter((s) => {
        const p = s.proctoring;
        return p && (p.tabSwitchCount > 0 || p.copyPasteAttempts > 0 || p.fullscreenExitCount > 0);
      });
    }

    // Sorting
    list.sort((a, b) => {
      const aInfractions = (a.proctoring?.tabSwitchCount || 0) + (a.proctoring?.copyPasteAttempts || 0) + (a.proctoring?.fullscreenExitCount || 0);
      const bInfractions = (b.proctoring?.tabSwitchCount || 0) + (b.proctoring?.copyPasteAttempts || 0) + (b.proctoring?.fullscreenExitCount || 0);

      switch (sortBy) {
        case "score_desc":
          return b.totalScore - a.totalScore;
        case "score_asc":
          return a.totalScore - b.totalScore;
        case "infractions_desc":
          return bInfractions - aInfractions;
        case "time_asc":
          return (a.timeSpentSeconds || 999999) - (b.timeSpentSeconds || 999999);
        case "rank_asc":
        default:
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return (a.timeSpentSeconds || 999999) - (b.timeSpentSeconds || 999999);
      }
    });

    return list;
  }, [analytics?.submissions, candidateSearch, statusFilter, integrityFilter, sortBy]);

  // Paginated Candidate Submissions (10 per page)
  const paginatedSubmissions = useMemo(() => {
    const start = (candidatePage - 1) * CANDIDATES_PER_PAGE;
    return filteredSubmissions.slice(start, start + CANDIDATES_PER_PAGE);
  }, [filteredSubmissions, candidatePage]);

  const totalCandidatePages = Math.max(1, Math.ceil(filteredSubmissions.length / CANDIDATES_PER_PAGE));

  // Paginated MCQ Question Performance (10 per page)
  const mcqQuestionsList = analytics?.mcqStats?.questions || [];
  const paginatedMcqQuestions = useMemo(() => {
    const start = (mcqStatsPage - 1) * STATS_PER_PAGE;
    return mcqQuestionsList.slice(start, start + STATS_PER_PAGE);
  }, [mcqQuestionsList, mcqStatsPage]);
  const totalMcqStatsPages = Math.max(1, Math.ceil(mcqQuestionsList.length / STATS_PER_PAGE));

  // Paginated Coding Challenges Performance (10 per page)
  const codingProblemsList = analytics?.codingStats?.problems || [];
  const paginatedCodingProblems = useMemo(() => {
    const start = (codingStatsPage - 1) * STATS_PER_PAGE;
    return codingProblemsList.slice(start, start + STATS_PER_PAGE);
  }, [codingProblemsList, codingStatsPage]);
  const totalCodingStatsPages = Math.max(1, Math.ceil(codingProblemsList.length / STATS_PER_PAGE));

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const copyCodeToClipboard = (qid: string, code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCodeId(qid);
      setTimeout(() => setCopiedCodeId(null), 2500);
    }
  };

  // ---------------------------------------------------------------------------------
  // Loading & Unauthorized States
  // ---------------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-mono text-xs font-bold flex items-center justify-center animate-pulse">
          Z
        </div>
      </div>
    );
  }

  if (!student || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex flex-col items-center justify-center p-4 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-8 rounded-2xl max-w-md w-full text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-white">Admin Access Restricted</h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
            You must be an authorized platform administrator to access Contest Analytics. Account:{" "}
            <strong>{student?.email || "Anonymous"}</strong>
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Arena</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col font-sans">
      {/* Unified Admin Navigation Header */}
      <AdminHeader
        activeSection="dashboard"
        activeItem="contests-analytics"
        contestCount={contests.length}
      />

      {/* 2. Main Analytics Canvas */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8">
        {/* Top Contest Selector & Title Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-mono uppercase font-bold tracking-wider mb-1.5">
              <Sparkles className="w-3 h-3" />
              <span>Contest Evaluation & Proctoring Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
              Submission Analytics & Telemetry
            </h1>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Cohort-wide grade distributions, question accuracy metrics, test cases breakdown, and student-level proctoring logs.
            </p>
          </div>

          {/* Contest Selector Dropdown & Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl px-3 py-1.5 shadow-xs">
              <Trophy className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <select
                value={selectedContestSlug}
                onChange={(e) => handleContestChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#0f172a] dark:text-white focus:outline-none cursor-pointer max-w-[220px] truncate"
              >
                {contests.map((c) => (
                  <option key={c.id} value={c.slug} className="dark:bg-[#121824] dark:text-white">
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadAnalytics}
              disabled={loadingAnalytics}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white hover:bg-slate-50 dark:hover:bg-[#1a2233] cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#64748b] ${loadingAnalytics ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Notice */}
        {errorNotice && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button type="button" onClick={() => setErrorNotice(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-center justify-between ${
              actionFeedback.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{actionFeedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="cursor-pointer hover:opacity-75"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loadingAnalytics ? (
          <div className="py-32 text-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-purple-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Computing cohort scores, proctoring violations, and question analytics...
            </p>
          </div>
        ) : !analytics ? (
          <div className="py-24 text-center bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-8 space-y-3">
            <Info className="w-8 h-8 text-[#94a3b8] mx-auto" />
            <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">No Analytics Data Found</h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              No submissions have been recorded for this contest yet.
            </p>
          </div>
        ) : (
          <>
            {/* 3. Executive KPI Ribbon (6 High-Density Metric Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* Total Candidates */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8]">
                  <span className="text-[11px] font-mono uppercase font-bold">Candidates</span>
                  <Users className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black font-mono text-[#0f172a] dark:text-white">
                  {analytics.totalCandidates}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{analytics.completionRate}% Completed</span>
                </div>
              </div>

              {/* Average Score */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8]">
                  <span className="text-[11px] font-mono uppercase font-bold">Avg Score</span>
                  <Award className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-black font-mono text-[#0f172a] dark:text-white">
                  {analytics.averageScore} <span className="text-xs font-normal text-[#64748b] dark:text-[#94a3b8]">/ {analytics.contest.totalPoints}</span>
                </div>
                <div className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                  Median: <strong className="text-[#0f172a] dark:text-white">{analytics.medianScore} pts</strong>
                </div>
              </div>

              {/* Highest Score */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8]">
                  <span className="text-[11px] font-mono uppercase font-bold">Highest Score</span>
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {analytics.highestScore} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">pts</span>
                </div>
                <div className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                  Lowest: <strong className="text-[#0f172a] dark:text-white">{analytics.lowestScore} pts</strong>
                </div>
              </div>

              {/* Average Time Spent */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8]">
                  <span className="text-[11px] font-mono uppercase font-bold">Avg Duration</span>
                  <Clock className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-black font-mono text-[#0f172a] dark:text-white">
                  {formatDuration(analytics.averageTimeSpentSeconds)}
                </div>
                <div className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                  Limit: <strong className="text-[#0f172a] dark:text-white">{analytics.contest.durationMinutes}m</strong>
                </div>
              </div>

              {/* Proctoring & Clean Sessions */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8]">
                  <span className="text-[11px] font-mono uppercase font-bold">Clean Sessions</span>
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {analytics.proctoringStats.cleanRate}%
                </div>
                <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                  Flagged: <strong className="text-amber-500">{analytics.proctoringStats.flaggedCandidatesCount} students</strong>
                </div>
              </div>

              {/* Total Infractions */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8]">
                  <span className="text-[11px] font-mono uppercase font-bold">Total Violations</span>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                </div>
                <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
                  {analytics.proctoringStats.totalInfractions}
                </div>
                <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                  Tabs: <strong className="text-[#0f172a] dark:text-white">{analytics.proctoringStats.totalTabSwitches}</strong> · Copy: <strong className="text-[#0f172a] dark:text-white">{analytics.proctoringStats.totalCopyPasteAttempts}</strong>
                </div>
              </div>
            </div>

            {/* 4. Visual Analytics: Score Distribution & Proctoring Spectrum */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Distribution Histogram */}
              <div className="lg:col-span-2 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-bold text-sm text-[#0f172a] dark:text-white">
                      Score Distribution Histogram
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                    {analytics.completedCount} Submissions Evaluated
                  </span>
                </div>

                {/* Vertical Bar Histogram */}
                <div className="h-52 flex items-end justify-between gap-4 pt-6 px-2">
                  {analytics.scoreDistribution.map((bucket) => {
                    const maxCount = Math.max(1, ...analytics.scoreDistribution.map((b) => b.count));
                    const heightPercent = Math.max(8, (bucket.count / maxCount) * 100);

                    return (
                      <div key={bucket.range} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        {/* Count Tooltip / Label */}
                        <div className="text-xs font-mono font-bold text-[#0f172a] dark:text-white transition-transform group-hover:-translate-y-1">
                          {bucket.count}
                        </div>

                        {/* Bar */}
                        <div className="w-full max-w-[56px] bg-[#f1f5f9] dark:bg-[#0b0f17] rounded-xl overflow-hidden flex flex-col justify-end p-1 border border-[#e2e8f0] dark:border-[#1e293b]">
                          <div
                            className="w-full rounded-lg bg-gradient-to-t from-purple-600 to-indigo-500 group-hover:from-purple-500 group-hover:to-indigo-400 transition-all duration-500 shadow-sm"
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>

                        {/* Bucket Label */}
                        <div className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] text-center whitespace-nowrap">
                          {bucket.range}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Proctoring Breakdown & Violations Radar */}
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <h3 className="font-bold text-sm text-[#0f172a] dark:text-white">
                        Integrity & Proctoring
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                      {analytics.proctoringStats.cleanCandidatesCount} Clean
                    </span>
                  </div>

                  {/* Violation Counters Breakdown */}
                  <div className="space-y-3 pt-3">
                    <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                          <EyeOff className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                          <strong className="block text-[#0f172a] dark:text-white">Tab Switches</strong>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Window blur & tab changes</span>
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono text-[#0f172a] dark:text-white">
                        {analytics.proctoringStats.totalTabSwitches}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                          <strong className="block text-[#0f172a] dark:text-white">Copy/Paste Interceptions</strong>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Clipboard copy/cut/paste attempts</span>
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                        {analytics.proctoringStats.totalCopyPasteAttempts}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                          <Lock className="w-4 h-4" />
                        </div>
                        <div className="text-xs">
                          <strong className="block text-[#0f172a] dark:text-white">Fullscreen Exits</strong>
                          <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Leaving fullscreen test mode</span>
                        </div>
                      </div>
                      <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                        {analytics.proctoringStats.totalFullscreenExits}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
                  <span>High Risk Candidates (&gt;= 3 events):</span>
                  <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                    {analytics.proctoringStats.highRiskCandidatesCount} students
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Question-Level Accuracy & Problem Acceptance */}
            <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-sm text-[#0f172a] dark:text-white">
                    Question Performance & Accuracy Analysis
                  </h3>
                </div>

                {/* Section Switcher Tabs */}
                <div className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
                  <button
                    type="button"
                    onClick={() => setQuestionBreakdownTab("mcq")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                      questionBreakdownTab === "mcq"
                        ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8]"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span>MCQ Questions ({analytics.mcqStats.questions.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionBreakdownTab("coding")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                      questionBreakdownTab === "coding"
                        ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8]"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Coding Challenges ({analytics.codingStats.problems.length})</span>
                  </button>
                </div>
              </div>

              {/* Table A: MCQs Performance Breakdown */}
              {questionBreakdownTab === "mcq" && (
                <div className="overflow-x-auto">
                  {analytics.mcqStats.questions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#64748b]">No MCQ questions found.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] font-mono uppercase text-[11px]">
                          <th className="py-2.5 px-3 font-semibold">Question Title</th>
                          <th className="py-2.5 px-3 font-semibold">Category</th>
                          <th className="py-2.5 px-3 font-semibold">Difficulty</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Attempts</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Correct</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Accuracy Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                        {paginatedMcqQuestions.map((q, idx) => {
                          const itemIndex = (mcqStatsPage - 1) * STATS_PER_PAGE + idx;
                          const isHigh = q.accuracyRate >= 70;
                          const isLow = q.accuracyRate < 40;

                          return (
                            <tr key={q.questionId} className="hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-colors">
                              <td className="py-3 px-3 font-medium text-[#0f172a] dark:text-white">
                                <span className="font-mono text-[#64748b] mr-1.5">Q{itemIndex + 1}.</span>
                                {q.title}
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#f1f5f9] dark:bg-[#0b0f17] text-[#475569] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#1e293b]">
                                  {q.category}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  {q.difficulty}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-mono">{q.totalAttempts}</td>
                              <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {q.correctCount}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-[#e2e8f0] dark:bg-[#0b0f17] overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        isHigh ? "bg-emerald-500" : isLow ? "bg-rose-500" : "bg-amber-500"
                                      }`}
                                      style={{ width: `${q.accuracyRate}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`font-mono font-bold text-xs ${
                                      isHigh ? "text-emerald-600 dark:text-emerald-400" : isLow ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {q.accuracyRate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {totalMcqStatsPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] text-xs text-[#64748b]">
                      <span>Showing {((mcqStatsPage - 1) * STATS_PER_PAGE) + 1} - {Math.min(mcqQuestionsList.length, mcqStatsPage * STATS_PER_PAGE)} of {mcqQuestionsList.length} MCQs</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setMcqStatsPage((p) => Math.max(1, p - 1))}
                          disabled={mcqStatsPage === 1}
                          className="px-2 py-1 rounded border border-[#e2e8f0] dark:border-[#1e293b] disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span>Page {mcqStatsPage} of {totalMcqStatsPages}</span>
                        <button
                          type="button"
                          onClick={() => setMcqStatsPage((p) => Math.min(totalMcqStatsPages, p + 1))}
                          disabled={mcqStatsPage === totalMcqStatsPages}
                          className="px-2 py-1 rounded border border-[#e2e8f0] dark:border-[#1e293b] disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Table B: Coding Problems Performance Breakdown */}
              {questionBreakdownTab === "coding" && (
                <div className="overflow-x-auto">
                  {analytics.codingStats.problems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#64748b]">No coding challenges found.</div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] font-mono uppercase text-[11px]">
                          <th className="py-2.5 px-3 font-semibold">Problem Title</th>
                          <th className="py-2.5 px-3 font-semibold">Difficulty</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Attempted</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Accepted</th>
                          <th className="py-2.5 px-3 font-semibold">Languages Used</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Acceptance Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                        {paginatedCodingProblems.map((p, idx) => {
                          const itemIndex = (codingStatsPage - 1) * STATS_PER_PAGE + idx;
                          return (
                            <tr key={p.questionId} className="hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-colors">
                              <td className="py-3 px-3 font-medium text-[#0f172a] dark:text-white">
                                <span className="font-mono text-[#64748b] mr-1.5">P{itemIndex + 1}.</span>
                                {p.title}
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                  {p.difficulty}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-mono">{p.attemptedCount}</td>
                              <td className="py-3 px-3 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {p.acceptedCount}
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {Object.entries(p.languagesUsed || {}).map(([lang, cnt]) => (
                                    <span
                                      key={lang}
                                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#0b0f17] text-[#475569] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#1e293b]"
                                    >
                                      {lang}: {cnt}
                                    </span>
                                  ))}
                                  {(!p.languagesUsed || Object.keys(p.languagesUsed).length === 0) && (
                                    <span className="text-[10px] text-[#64748b]">None recorded</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-[#e2e8f0] dark:bg-[#0b0f17] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-emerald-500"
                                      style={{ width: `${p.acceptanceRate}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                    {p.acceptanceRate}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {totalCodingStatsPages > 1 && (
                    <div className="flex items-center justify-between pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] text-xs text-[#64748b]">
                      <span>Showing {((codingStatsPage - 1) * STATS_PER_PAGE) + 1} - {Math.min(codingProblemsList.length, codingStatsPage * STATS_PER_PAGE)} of {codingProblemsList.length} Challenges</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCodingStatsPage((p) => Math.max(1, p - 1))}
                          disabled={codingStatsPage === 1}
                          className="px-2 py-1 rounded border border-[#e2e8f0] dark:border-[#1e293b] disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <span>Page {codingStatsPage} of {totalCodingStatsPages}</span>
                        <button
                          type="button"
                          onClick={() => setCodingStatsPage((p) => Math.min(totalCodingStatsPages, p + 1))}
                          disabled={codingStatsPage === totalCodingStatsPages}
                          className="px-2 py-1 rounded border border-[#e2e8f0] dark:border-[#1e293b] disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 6. Student-Based Analysis & Submissions Leaderboard Table */}
            <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-bold text-base text-[#0f172a] dark:text-white">
                    Candidate Submissions & Individual Analysis ({filteredSubmissions.length})
                  </h3>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search candidate name or email..."
                      value={candidateSearch}
                      onChange={(e) => {
                        setCandidateSearch(e.target.value);
                        setCandidatePage(1);
                      }}
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:border-purple-500 w-48 sm:w-64"
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value as any);
                      setCandidatePage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="SUBMITTED">Submitted Only</option>
                    <option value="IN_PROGRESS">In Progress Only</option>
                  </select>

                  {/* Integrity Filter */}
                  <select
                    value={integrityFilter}
                    onChange={(e) => {
                      setIntegrityFilter(e.target.value as any);
                      setCandidatePage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Integrity</option>
                    <option value="CLEAN">Clean Sessions (0 Violations)</option>
                    <option value="FLAGGED">Flagged (&gt; 0 Violations)</option>
                  </select>

                  {/* Sorting */}
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as any);
                      setCandidatePage(1);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="rank_asc">Sort by Rank / Highest Score</option>
                    <option value="score_asc">Sort by Score (Lowest)</option>
                    <option value="infractions_desc">Sort by Most Infractions</option>
                    <option value="time_asc">Sort by Fastest Time</option>
                  </select>
                </div>
              </div>

              {/* Submissions Table */}
              <div className="overflow-x-auto">
                {filteredSubmissions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                    No candidates matching current filter criteria.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] font-mono uppercase text-[11px]">
                        <th className="py-3 px-3 font-semibold text-center w-12">Rank</th>
                        <th className="py-3 px-3 font-semibold">Candidate</th>
                        <th className="py-3 px-3 font-semibold text-center">Status</th>
                        <th className="py-3 px-3 font-semibold text-center">Total Score</th>
                        <th className="py-3 px-3 font-semibold text-center">MCQ Pts</th>
                        <th className="py-3 px-3 font-semibold text-center">Coding Pts</th>
                        <th className="py-3 px-3 font-semibold text-center">Time Spent</th>
                        <th className="py-3 px-3 font-semibold text-center">Integrity Status</th>
                        <th className="py-3 px-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                      {paginatedSubmissions.map((sub, idx) => {
                        const rankIdx = (candidatePage - 1) * CANDIDATES_PER_PAGE + idx;
                        const proc = sub.proctoring || { tabSwitchCount: 0, copyPasteAttempts: 0, fullscreenExitCount: 0 };
                        const infractions = proc.tabSwitchCount + proc.copyPasteAttempts + proc.fullscreenExitCount;
                        const isTopRank = rankIdx < 3;

                        return (
                          <tr
                            key={sub.id || sub.submissionId || sub.studentId}
                            className="hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-colors"
                          >
                            <td className="py-3 px-3 text-center">
                              {isTopRank ? (
                                <span
                                  className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                                    rankIdx === 0
                                      ? "bg-amber-400/20 text-amber-500 border border-amber-400/40"
                                      : rankIdx === 1
                                      ? "bg-slate-300/20 text-slate-400 border border-slate-300/40"
                                      : "bg-amber-700/20 text-amber-600 border border-amber-700/40"
                                  }`}
                                >
                                  {rankIdx + 1}
                                </span>
                              ) : (
                                <span className="font-mono text-[#64748b]">#{rankIdx + 1}</span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="font-bold text-[#0f172a] dark:text-white">
                                  {sub.studentName || "Anonymous Candidate"}
                                </span>
                                <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                                  {sub.studentEmail || sub.studentId}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center">
                              {sub.status === "SUBMITTED" ? (
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                                  Submitted
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 animate-pulse">
                                  In Progress
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              <div className="inline-flex items-baseline gap-1">
                                <span className="font-mono font-black text-sm text-[#0f172a] dark:text-white">
                                  {sub.totalScore}
                                </span>
                                <span className="text-[10px] font-mono text-[#64748b]">
                                  / {sub.maxTotalScore || analytics.contest.totalPoints}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ml-1">
                                  ({sub.percentage}%)
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-center font-mono">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">{sub.mcqScore}</span>
                              <span className="text-[10px] text-[#64748b]"> ({sub.mcqCorrectCount} corr)</span>
                            </td>

                            <td className="py-3 px-3 text-center font-mono">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{sub.codingScore}</span>
                              <span className="text-[10px] text-[#64748b]"> ({sub.codingProblemsAttempted} att)</span>
                            </td>

                            <td className="py-3 px-3 text-center font-mono text-[#64748b] dark:text-[#94a3b8]">
                              {formatDuration(sub.timeSpentSeconds || 0)}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {infractions === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Clean (0)</span>
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    infractions >= 3
                                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  }`}
                                  title={`${proc.tabSwitchCount} tab switches, ${proc.copyPasteAttempts} copy attempts, ${proc.fullscreenExitCount} exits`}
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>{infractions} Flagged</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleInspectStudent(sub)}
                                  className="px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-xs cursor-pointer transition-all"
                                >
                                  Inspect
                                </button>
                                <button
                                  type="button"
                                  disabled={resettingCandidateId === (sub.submissionId || sub.id || sub.studentId)}
                                  onClick={() => void handleResetCandidate(sub)}
                                  className="px-2.5 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold text-xs cursor-pointer transition-all flex items-center gap-1 disabled:opacity-50"
                                  title="Reset and delete candidate contest data"
                                >
                                  <RotateCcw className={`w-3 h-3 ${resettingCandidateId === (sub.submissionId || sub.id || sub.studentId) ? "animate-spin" : ""}`} />
                                  <span>Reset Data</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Candidate Submissions Pagination (10 per page) */}
                {filteredSubmissions.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] text-xs text-[#64748b] dark:text-[#94a3b8]">
                    <div>
                      Showing{" "}
                      <strong className="text-[#0f172a] dark:text-white">
                        {Math.min(filteredSubmissions.length, (candidatePage - 1) * CANDIDATES_PER_PAGE + 1)}
                      </strong>{" "}
                      to{" "}
                      <strong className="text-[#0f172a] dark:text-white">
                        {Math.min(filteredSubmissions.length, candidatePage * CANDIDATES_PER_PAGE)}
                      </strong>{" "}
                      of{" "}
                      <strong className="text-[#0f172a] dark:text-white">{filteredSubmissions.length}</strong> candidates
                    </div>

                    {totalCandidatePages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCandidatePage((p) => Math.max(1, p - 1))}
                          disabled={candidatePage === 1}
                          className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] hover:bg-slate-100 dark:hover:bg-[#1a2233] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                        >
                          Previous
                        </button>

                        <span className="px-2 py-1 text-xs font-semibold text-[#0f172a] dark:text-white">
                          Page {candidatePage} of {totalCandidatePages}
                        </span>

                        <button
                          type="button"
                          onClick={() => setCandidatePage((p) => Math.min(totalCandidatePages, p + 1))}
                          disabled={candidatePage === totalCandidatePages}
                          className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] hover:bg-slate-100 dark:hover:bg-[#1a2233] disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* -----------------------------------------------------------------------------
          7. Individual Student Deep-Dive Inspection Modal / Drawer
      ----------------------------------------------------------------------------- */}
      {inspectingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between bg-[#f8fafc] dark:bg-[#0b0f17]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {inspectingStudent.studentName?.charAt(0) || inspectingStudent.studentEmail?.charAt(0) || "S"}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0f172a] dark:text-white leading-tight">
                    {inspectingStudent.studentName || "Candidate Dossier"}
                  </h3>
                  <p className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                    {inspectingStudent.studentEmail} · ID: {inspectingStudent.studentId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  Total: {inspectingStudent.totalScore} pts ({inspectingStudent.percentage}%)
                </span>
                <button
                  type="button"
                  disabled={resettingCandidateId === (inspectingStudent.submissionId || inspectingStudent.id || inspectingStudent.studentId)}
                  onClick={() => void handleResetCandidate(inspectingStudent)}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold text-xs cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                  title="Reset and delete candidate data for this contest"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resettingCandidateId === (inspectingStudent.submissionId || inspectingStudent.id || inspectingStudent.studentId) ? "animate-spin" : ""}`} />
                  <span>Reset Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingStudent(null)}
                  className="p-1.5 rounded-xl text-[#64748b] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Tabs Bar */}
            <div className="px-6 py-2 border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center gap-2 text-xs bg-white dark:bg-[#121824]">
              <button
                type="button"
                onClick={() => setStudentDrawerTab("overview")}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  studentDrawerTab === "overview"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                Overview & Scores
              </button>
              <button
                type="button"
                onClick={() => setStudentDrawerTab("proctoring")}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  studentDrawerTab === "proctoring"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                Proctoring Log ({(inspectingStudent.proctoring?.violationsLog || []).length})
              </button>
              <button
                type="button"
                onClick={() => setStudentDrawerTab("mcq")}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  studentDrawerTab === "mcq"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                MCQ Solutions ({(inspectingStudent.mcqBreakdown || []).length})
              </button>
              <button
                type="button"
                onClick={() => setStudentDrawerTab("coding")}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  studentDrawerTab === "coding"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-[#64748b] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                Code Inspector ({(inspectingStudent.codingBreakdown || []).length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {loadingStudentDetail ? (
                <div className="py-24 flex flex-col items-center justify-center text-xs text-[#64748b] dark:text-[#94a3b8] gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
                  <span className="font-semibold text-sm text-[#0f172a] dark:text-white">Loading candidate submission dossier...</span>
                  <span className="text-[11px]">Fetching candidate code, test cases, and telemetry from database</span>
                </div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
              {studentDrawerTab === "overview" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                      <span className="text-[10px] text-[#64748b] uppercase font-mono">Status</span>
                      <div className="text-base font-bold font-mono text-[#0f172a] dark:text-white mt-1">
                        {inspectingStudent.status}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                      <span className="text-[10px] text-[#64748b] uppercase font-mono">Time Spent</span>
                      <div className="text-base font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                        {formatDuration(inspectingStudent.timeSpentSeconds || 0)}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                      <span className="text-[10px] text-[#64748b] uppercase font-mono">MCQ Score</span>
                      <div className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                        {inspectingStudent.mcqScore}% ({inspectingStudent.mcqCorrectCount} / {inspectingStudent.mcqTotalCount || 25} corr)
                      </div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                      <span className="text-[10px] text-[#64748b] uppercase font-mono">Coding Score (Avg)</span>
                      <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {inspectingStudent.codingScore}% ({inspectingStudent.codingProblemsAttempted} att)
                      </div>
                    </div>
                  </div>

                  {/* Proctoring telemetry recap */}
                  <div className="p-4 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] space-y-2">
                    <span className="text-xs font-bold text-[#0f172a] dark:text-white">Proctoring Telemetry Recap</span>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b]">
                        <span className="text-[10px] text-[#64748b]">Tab Switches</span>
                        <div className="text-lg font-bold font-mono text-[#0f172a] dark:text-white">
                          {inspectingStudent.proctoring?.tabSwitchCount || 0}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b]">
                        <span className="text-[10px] text-[#64748b]">Copy/Paste Attempts</span>
                        <div className="text-lg font-bold font-mono text-rose-500">
                          {inspectingStudent.proctoring?.copyPasteAttempts || 0}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b]">
                        <span className="text-[10px] text-[#64748b]">Fullscreen Exits</span>
                        <div className="text-lg font-bold font-mono text-amber-500">
                          {inspectingStudent.proctoring?.fullscreenExitCount || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PROCTORING EVENT TIMELINE */}
              {studentDrawerTab === "proctoring" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                    <h4 className="text-xs font-bold uppercase font-mono text-[#64748b]">
                      Chronological Violation Events Log
                    </h4>
                    <span className="text-xs font-mono font-semibold text-rose-500">
                      {(inspectingStudent.proctoring?.violationsLog || []).length} Events Flagged
                    </span>
                  </div>

                  {(!inspectingStudent.proctoring?.violationsLog || inspectingStudent.proctoring.violationsLog.length === 0) ? (
                    <div className="py-12 text-center text-xs text-emerald-600 dark:text-emerald-400 space-y-2">
                      <ShieldCheck className="w-8 h-8 mx-auto" />
                      <p className="font-bold">Zero Violations Recorded</p>
                      <p className="text-[11px] text-[#64748b]">Candidate maintained 100% fullscreen and window integrity throughout the session.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {inspectingStudent.proctoring.violationsLog.map((v, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-md bg-rose-500/15 text-rose-500 flex items-center justify-center text-[10px] font-bold mt-0.5">
                              #{i + 1}
                            </span>
                            <div>
                              <strong className="block text-[#0f172a] dark:text-white font-mono">
                                {v.type}
                              </strong>
                              <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                                {v.details || "Integrity violation recorded"}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-[#64748b] shrink-0">
                            {new Date(v.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MCQ REVIEW */}
              {studentDrawerTab === "mcq" && (
                <div className="space-y-4">
                  {(!inspectingStudent.mcqBreakdown || inspectingStudent.mcqBreakdown.length === 0) ? (
                    <div className="py-12 text-center text-xs text-[#64748b]">
                      No MCQ breakdown available for this candidate.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {inspectingStudent.mcqBreakdown.map((item, idx) => (
                        <div
                          key={item.questionId}
                          className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                            item.isCorrect
                              ? "border-emerald-500/25 bg-emerald-500/5"
                              : "border-rose-500/25 bg-rose-500/5"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0f172a] dark:text-white">
                              Q{idx + 1}. {item.title}
                            </span>
                            <span
                              className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                                item.isCorrect ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500"
                              }`}
                            >
                              {item.pointsAwarded} pts
                            </span>
                          </div>
                          <p className="text-[#475569] dark:text-[#94a3b8] leading-relaxed">{item.statement}</p>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-[11px] flex items-center justify-between">
                            <span>
                              Selected: <strong className={item.isCorrect ? "text-emerald-500" : "text-rose-500"}>{item.selectedOptionId || "Unanswered"}</strong>
                            </span>
                            <span className="text-[#64748b]">
                              Correct Answer: <strong className="text-emerald-500">{item.correctOptionId}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CODING INSPECTOR & SOURCE CODE */}
              {studentDrawerTab === "coding" && (
                <div className="space-y-6">
                  {(!inspectingStudent.codingBreakdown || inspectingStudent.codingBreakdown.length === 0) ? (
                    <div className="py-12 text-center text-xs text-[#64748b]">
                      No coding problems recorded for this candidate.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {inspectingStudent.codingBreakdown.map((p, idx) => {
                        const probState = inspectingStudent.codingState?.[p.questionId];
                        const lastLang = probState?.lastLanguage || "python";
                        const sourceCode = probState?.code?.[lastLang] || "// No code saved for this problem.";

                        return (
                          <div
                            key={p.questionId}
                            className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-5 space-y-3"
                          >
                            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                              <div>
                                <span className="font-bold text-sm text-[#0f172a] dark:text-white">
                                  P{idx + 1}. {p.title}
                                </span>
                                <span className="text-[10px] font-mono ml-2 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                                  {p.difficulty}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full ${
                                    p.status === "ACCEPTED"
                                      ? "bg-emerald-500/15 text-emerald-500"
                                      : "bg-blue-500/15 text-blue-500"
                                  }`}
                                >
                                  {p.status} ({p.score}%)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyCodeToClipboard(p.questionId, sourceCode)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#121824] text-[11px] font-medium text-[#64748b] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
                                >
                                  {copiedCodeId === p.questionId ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Code</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Source Code Container */}
                            <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824]">
                              <div className="px-3 py-1.5 bg-[#f1f5f9] dark:bg-[#1a2233] border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-[10px] font-mono text-[#64748b]">
                                <span>Language: {lastLang.toUpperCase()}</span>
                                <span>Verdict: {probState?.bestVerdict || p.status}</span>
                              </div>
                              <pre className="p-4 text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] overflow-x-auto leading-relaxed max-h-80">
                                {sourceCode}
                              </pre>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
      <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-mono text-xs font-bold flex items-center justify-center animate-pulse">
        Z
      </div>
    </div>
  );
}

export default function AdminContestsAnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <ContestAnalyticsContent />
    </Suspense>
  );
}
