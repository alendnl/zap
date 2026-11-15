"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  Code2,
  BookOpen,
  Plus,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Shuffle,
  ListChecks,
  Check,
  ChevronRight,
  Database,
  Sliders,
  BarChart3,
} from "lucide-react";
import { getStoredStudent } from "@/services/authApi";
import { adminApi } from "@/services/adminApi";
import { contestApi } from "@/services/contestApi";
import { mcqApi } from "@/services/mcqApi";
import { questionsApi } from "@/services/questionsApi";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminHeader } from "@/components/AdminHeader";
import type { Student } from "@/types/auth";
import type {
  Contest,
  ContestSummary,
  ContestFormData,
  SelectionMode,
  MCQRandomRule,
  CodingRandomRule,
} from "@/types/contest";
import type { MCQQuestionSummary } from "@/types/mcq";
import type { QuestionSummary } from "@/types/question";

export default function AdminContestsPage() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Tabs: "directory" | "create"
  const [activeTab, setActiveTab] = useState<"directory" | "create">("directory");

  // Contests list state
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loadingContests, setLoadingContests] = useState(true);
  const [contestFilter, setContestFilter] = useState<string>("ALL");

  // Database questions for selection
  const [dbMcqs, setDbMcqs] = useState<MCQQuestionSummary[]>([]);
  const [loadingDbMcqs, setLoadingDbMcqs] = useState(false);
  const [dbCodingQuestions, setDbCodingQuestions] = useState<QuestionSummary[]>([]);
  const [loadingDbCoding, setLoadingDbCoding] = useState(false);

  // Search & filter within question pickers
  const [mcqSearch, setMcqSearch] = useState("");
  const [mcqCategoryFilter, setMcqCategoryFilter] = useState("ALL");
  const [mcqDifficultyFilter, setMcqDifficultyFilter] = useState("ALL");

  const [codingSearch, setCodingSearch] = useState("");
  const [codingDifficultyFilter, setCodingDifficultyFilter] = useState("ALL");

  // Form State for creating a contest
  const [formData, setFormData] = useState<ContestFormData>({
    title: "",
    slug: "",
    description: "",
    durationMinutes: 90,
    hasMcq: true,
    hasCoding: true,
    mcqConfig: {
      enabled: true,
      mode: "MANUAL",
      questionIds: [],
      randomRules: [
        { category: "DSA", difficulty: "ALL", count: 10 },
        { category: "DBMS", difficulty: "ALL", count: 5 },
        { category: "NETWORKS", difficulty: "ALL", count: 5 },
        { category: "OOPS", difficulty: "ALL", count: 5 },
      ],
      totalQuestions: 25,
      pointsPerQuestion: 1,
    },
    codingConfig: {
      enabled: true,
      mode: "MANUAL",
      questionIds: [],
      randomRules: [
        { difficulty: "EASY", tag: "ALL", count: 1 },
        { difficulty: "MEDIUM", tag: "ALL", count: 1 },
        { difficulty: "HARD", tag: "ALL", count: 1 },
      ],
      totalQuestions: 3,
      pointsPerQuestion: 10,
    },
    status: "PUBLISHED",
    totalPoints: 55,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Auth gate check
  useEffect(() => {
    const current = getStoredStudent();
    setStudent(current);
    if (!current?.email) {
      setAuthLoading(false);
      return;
    }
    adminApi
      .checkAdmin(current.email)
      .then((allowed) => {
        setIsAdmin(allowed);
        setAuthLoading(false);
      })
      .catch(() => {
        setIsAdmin(false);
        setAuthLoading(false);
      });
  }, []);

  // Fetch contests list
  const loadContests = useCallback(async () => {
    setLoadingContests(true);
    try {
      const data = await contestApi.list(contestFilter === "ALL" ? undefined : contestFilter);
      setContests(data || []);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load contests.");
    } finally {
      setLoadingContests(false);
    }
  }, [contestFilter]);

  useEffect(() => {
    if (isAdmin) {
      void loadContests();
    }
  }, [isAdmin, loadContests]);

  // Fetch database questions when in creation mode
  useEffect(() => {
    if (activeTab === "create") {
      setLoadingDbMcqs(true);
      mcqApi
        .list(undefined, undefined, "PUBLISHED", undefined, true)
        .then((data) => setDbMcqs(data || []))
        .catch(() => setDbMcqs([]))
        .finally(() => setLoadingDbMcqs(false));

      setLoadingDbCoding(true);
      questionsApi
        .list("PUBLISHED", true)
        .then((data) => setDbCodingQuestions(data || []))
        .catch(() => setDbCodingQuestions([]))
        .finally(() => setLoadingDbCoding(false));
    }
  }, [activeTab]);

  // Title -> slug generator
  const handleTitleChange = (val: string) => {
    const slug = val
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug,
    }));
  };

  // Toggle MCQ Question Selection
  const toggleMcqQuestion = (qid: string) => {
    setFormData((prev) => {
      const exists = prev.mcqConfig.questionIds.includes(qid);
      const updated = exists
        ? prev.mcqConfig.questionIds.filter((id) => id !== qid)
        : [...prev.mcqConfig.questionIds, qid];
      return {
        ...prev,
        mcqConfig: {
          ...prev.mcqConfig,
          questionIds: updated,
          totalQuestions: updated.length,
        },
      };
    });
  };

  // Toggle Coding Question Selection
  const toggleCodingQuestion = (qid: string) => {
    setFormData((prev) => {
      const exists = prev.codingConfig.questionIds.includes(qid);
      const updated = exists
        ? prev.codingConfig.questionIds.filter((id) => id !== qid)
        : [...prev.codingConfig.questionIds, qid];
      return {
        ...prev,
        codingConfig: {
          ...prev.codingConfig,
          questionIds: updated,
          totalQuestions: updated.length,
        },
      };
    });
  };

  // Filtered MCQ list from DB
  const filteredDbMcqs = useMemo(() => {
    return dbMcqs.filter((q) => {
      const matchesSearch =
        !mcqSearch ||
        q.title.toLowerCase().includes(mcqSearch.toLowerCase()) ||
        q.statement?.toLowerCase().includes(mcqSearch.toLowerCase());
      const matchesCategory =
        mcqCategoryFilter === "ALL" || q.category.toUpperCase() === mcqCategoryFilter.toUpperCase();
      const matchesDifficulty =
        mcqDifficultyFilter === "ALL" || q.difficulty.toUpperCase() === mcqDifficultyFilter.toUpperCase();
      return matchesSearch && matchesCategory && matchesDifficulty;
    });
  }, [dbMcqs, mcqSearch, mcqCategoryFilter, mcqDifficultyFilter]);

  // Filtered Coding questions from DB
  const filteredDbCoding = useMemo(() => {
    return dbCodingQuestions.filter((q) => {
      const matchesSearch =
        !codingSearch || q.title.toLowerCase().includes(codingSearch.toLowerCase());
      const matchesDifficulty =
        codingDifficultyFilter === "ALL" || q.difficulty.toUpperCase() === codingDifficultyFilter.toUpperCase();
      return matchesSearch && matchesDifficulty;
    });
  }, [dbCodingQuestions, codingSearch, codingDifficultyFilter]);

  // Random Rules Count Sums
  const mcqRandomTotal = useMemo(() => {
    return formData.mcqConfig.randomRules.reduce((acc, r) => acc + (r.count || 0), 0);
  }, [formData.mcqConfig.randomRules]);

  const codingRandomTotal = useMemo(() => {
    return formData.codingConfig.randomRules.reduce((acc, r) => acc + (r.count || 0), 0);
  }, [formData.codingConfig.randomRules]);

  // Estimated points
  const calculatedTotalPoints = useMemo(() => {
    let pts = 0;
    if (formData.hasMcq) {
      const mcqCount =
        formData.mcqConfig.mode === "MANUAL"
          ? formData.mcqConfig.questionIds.length
          : mcqRandomTotal;
      pts += mcqCount * (formData.mcqConfig.pointsPerQuestion || 1);
    }
    if (formData.hasCoding) {
      const codingCount =
        formData.codingConfig.mode === "MANUAL"
          ? formData.codingConfig.questionIds.length
          : codingRandomTotal;
      pts += codingCount * (formData.codingConfig.pointsPerQuestion || 10);
    }
    return pts;
  }, [formData, mcqRandomTotal, codingRandomTotal]);

  // Submit new contest form
  const handleCreateContest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);
    setSuccessNotice(null);

    if (!formData.title.trim()) {
      setErrorNotice("Contest title is required.");
      return;
    }
    if (!formData.slug.trim()) {
      setErrorNotice("Contest slug is required.");
      return;
    }
    if (!formData.hasMcq && !formData.hasCoding) {
      setErrorNotice("Contest must include at least one section: MCQ or Coding.");
      return;
    }

    if (formData.hasMcq) {
      if (formData.mcqConfig.mode === "MANUAL" && formData.mcqConfig.questionIds.length === 0) {
        setErrorNotice("Manual MCQ mode selected: please pick at least one MCQ from the database list.");
        return;
      }
      if (formData.mcqConfig.mode === "RANDOM" && mcqRandomTotal === 0) {
        setErrorNotice("Random MCQ mode selected: please assign question counts to at least one category.");
        return;
      }
    }

    if (formData.hasCoding) {
      if (formData.codingConfig.mode === "MANUAL" && formData.codingConfig.questionIds.length === 0) {
        setErrorNotice("Manual Coding mode selected: please pick at least one coding problem from the database list.");
        return;
      }
      if (formData.codingConfig.mode === "RANDOM" && codingRandomTotal === 0) {
        setErrorNotice("Random Coding mode selected: please assign question counts to at least one difficulty.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: ContestFormData = {
        ...formData,
        totalPoints: calculatedTotalPoints || formData.totalPoints,
        mcqConfig: {
          ...formData.mcqConfig,
          totalQuestions:
            formData.mcqConfig.mode === "MANUAL"
              ? formData.mcqConfig.questionIds.length
              : mcqRandomTotal,
        },
        codingConfig: {
          ...formData.codingConfig,
          totalQuestions:
            formData.codingConfig.mode === "MANUAL"
              ? formData.codingConfig.questionIds.length
              : codingRandomTotal,
        },
      };

      await contestApi.create(payload);
      setSuccessNotice(`Contest "${formData.title}" created and published successfully!`);
      setActiveTab("directory");
      void loadContests();
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to create contest.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete contest
  const handleDeleteContest = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete contest "${title}"?`)) return;
    try {
      await contestApi.delete(id);
      void loadContests();
    } catch (err: any) {
      alert(err.message || "Failed to delete contest.");
    }
  };

  // Seed sample 25 MCQ + 3 Coding contest
  const handleSeedSample = async () => {
    try {
      await contestApi.seedSample(true);
      void loadContests();
      setSuccessNotice("Standard 25 MCQ + 3 Coding question contest seeded successfully!");
    } catch (err: any) {
      alert(err.message || "Failed to seed sample contest.");
    }
  };

  // Auth Guard Screen
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
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-8 rounded-2xl max-w-md w-full text-center shadow-lg space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-white">Admin Access Restricted</h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
            You must be an authorized platform administrator to access the Contest Studio. Current account:{" "}
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
        activeSection="studio"
        activeItem="contests"
        contestCount={contests.length}
      />

      {/* Main Canvas */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full space-y-6">
        {/* Banner with Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[10px] font-mono uppercase font-bold tracking-wider mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Contest Authoring & Management</span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
              Contest Studio
            </h1>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Assemble timed competitive assessments combining multiple-choice conceptual questions and hands-on algorithm judge challenges directly from your database.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/contests/analytics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-500/20 cursor-pointer shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Submissions Dashboard</span>
            </Link>

            <button
              type="button"
              onClick={handleSeedSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white hover:bg-slate-50 dark:hover:bg-[#1a2233] cursor-pointer shadow-xs"
              title="Seed 25 MCQ + 3 Coding Question Sample Contest"
            >
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              <span>Seed Grand Challenge #1</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "directory" ? "create" : "directory")}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              {activeTab === "directory" ? (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Contest</span>
                </>
              ) : (
                <>
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>View All Contests</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notices */}
        {errorNotice && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button type="button" onClick={() => setErrorNotice(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button type="button" onClick={() => setSuccessNotice(null)} className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: CONTESTS DIRECTORY */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                Active Contests ({contests.length})
              </span>
              <button
                type="button"
                onClick={loadContests}
                disabled={loadingContests}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingContests ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingContests ? (
              <div className="py-20 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                Loading contests from database...
              </div>
            ) : contests.length === 0 ? (
              <div className="py-20 text-center bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-8 space-y-3">
                <Trophy className="w-8 h-8 text-[#94a3b8] mx-auto" />
                <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">No Contests Created Yet</h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-sm mx-auto">
                  Click "Seed Grand Challenge #1" above to initialize the sample contest, or click "Create Contest" to design a new assessment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {contests.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-5 shadow-xs hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold font-mono">
                          {c.status}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                          {c.slug}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[#0f172a] dark:text-white">
                        {c.title}
                      </h3>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8] line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{c.durationMinutes} mins</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{c.mcqQuestionsCount} MCQs</span>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                          <Code2 className="w-3.5 h-3.5" />
                          <span>{c.codingQuestionsCount} Coding Problems</span>
                        </span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-[#0f172a] dark:text-white">
                          {c.totalPoints} Total Pts
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        href={`/admin/contests/analytics?contest=${c.slug}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 cursor-pointer"
                        title="View Submission Analytics & Proctoring Telemetry"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Analytics</span>
                      </Link>
                      <Link
                        href={`/?tab=contest&contest=${c.slug}`}
                        className="px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-[#1a2233] cursor-pointer"
                        title="Candidate Preview"
                      >
                        Preview
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDeleteContest(c.id, c.title)}
                        className="p-2 rounded-xl text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete Contest"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CREATE CONTEST STUDIO */}
        {activeTab === "create" && (
          <form onSubmit={handleCreateContest} className="space-y-8">
            {/* 1. Basic Details Card */}
            <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2 pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>1. General Assessment Details</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-[#0f172a] dark:text-white">
                    Contest Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. TCS NQT National Placement Benchmark 2025"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0f172a] dark:text-white">
                    URL Slug <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g. tcs-nqt-2025-benchmark"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs font-mono text-[#0f172a] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#0f172a] dark:text-white">
                    Duration (Minutes) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={5}
                    max={1440}
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs font-mono text-[#0f172a] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-semibold text-[#0f172a] dark:text-white">
                    Instructions & Description <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed guidelines, syllabus topics covered, and timing expectations for students..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* 2. Section Inclusions Toggle */}
            <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2 pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>2. Contest Structure & Section Toggles</span>
              </h2>

              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Select whether this contest features MCQ questions, hands-on programming problems, or both.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* MCQ Checkbox Card */}
                <div
                  onClick={() => setFormData((p) => ({ ...p, hasMcq: !p.hasMcq }))}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    formData.hasMcq
                      ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/15"
                      : "border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] opacity-60"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-white mt-0.5 ${
                      formData.hasMcq ? "bg-blue-600" : "border border-slate-400"
                    }`}
                  >
                    {formData.hasMcq && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                      Include MCQ Section
                    </h4>
                    <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                      Conceptual multiple-choice questions (e.g. 25 questions across DSA, DBMS, Networks, OOPS).
                    </p>
                  </div>
                </div>

                {/* Coding Checkbox Card */}
                <div
                  onClick={() => setFormData((p) => ({ ...p, hasCoding: !p.hasCoding }))}
                  className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                    formData.hasCoding
                      ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15"
                      : "border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] opacity-60"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-white mt-0.5 ${
                      formData.hasCoding ? "bg-emerald-600" : "border border-slate-400"
                    }`}
                  >
                    {formData.hasCoding && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                      Include Coding Section
                    </h4>
                    <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                      Hands-on algorithmic problems with Monaco editor, testcase execution, and judge evaluation.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. MCQ Section Configuration (when enabled) */}
            {formData.hasMcq && (
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                  <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>3. MCQ Section Configuration</span>
                  </h2>

                  {/* Mode Tabs */}
                  <div className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          mcqConfig: { ...p.mcqConfig, mode: "MANUAL" },
                        }))
                      }
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        formData.mcqConfig.mode === "MANUAL"
                          ? "bg-white dark:bg-[#1a2233] text-blue-600 dark:text-blue-400 shadow-xs"
                          : "text-[#64748b] dark:text-[#94a3b8]"
                      }`}
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>1. Select from Database List ({formData.mcqConfig.questionIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          mcqConfig: { ...p.mcqConfig, mode: "RANDOM" },
                        }))
                      }
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        formData.mcqConfig.mode === "RANDOM"
                          ? "bg-white dark:bg-[#1a2233] text-purple-600 dark:text-purple-400 shadow-xs"
                          : "text-[#64748b] dark:text-[#94a3b8]"
                      }`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>2. Random by Category ({mcqRandomTotal})</span>
                    </button>
                  </div>
                </div>

                {/* Option 1: Manual List Picker from Database */}
                {formData.mcqConfig.mode === "MANUAL" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Search & Filters */}
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="w-3.5 h-3.5 text-[#64748b] dark:text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search DB MCQs..."
                            value={mcqSearch}
                            onChange={(e) => setMcqSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white"
                          />
                        </div>

                        <select
                          value={mcqCategoryFilter}
                          onChange={(e) => setMcqCategoryFilter(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white font-mono"
                        >
                          <option value="ALL">All Categories</option>
                          <option value="DSA">DSA</option>
                          <option value="DBMS">DBMS</option>
                          <option value="NETWORKS">Networks</option>
                          <option value="OOPS">OOPS</option>
                          <option value="OS">OS</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const allFilteredIds = filteredDbMcqs.map((q) => q.id);
                            setFormData((p) => ({
                              ...p,
                              mcqConfig: {
                                ...p.mcqConfig,
                                questionIds: Array.from(new Set([...p.mcqConfig.questionIds, ...allFilteredIds])),
                              },
                            }));
                          }}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                        >
                          Select All Visible
                        </button>
                        <span>·</span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              mcqConfig: { ...p.mcqConfig, questionIds: [] },
                            }))
                          }
                          className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Database List */}
                    <div className="max-h-72 overflow-y-auto border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                      {loadingDbMcqs ? (
                        <div className="p-8 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                          Loading database questions...
                        </div>
                      ) : filteredDbMcqs.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                          No database MCQs match the filter.
                        </div>
                      ) : (
                        filteredDbMcqs.map((q) => {
                          const isSelected = formData.mcqConfig.questionIds.includes(q.id);
                          return (
                            <div
                              key={q.id}
                              onClick={() => toggleMcqQuestion(q.id)}
                              className={`p-3 text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-blue-500/10 dark:bg-blue-500/15"
                                  : "hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-4 h-4 rounded-md flex items-center justify-center ${
                                    isSelected
                                      ? "bg-blue-600 text-white"
                                      : "border border-slate-300 dark:border-slate-600"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-[#0f172a] dark:text-white">
                                    {q.title}
                                  </span>
                                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] line-clamp-1">
                                    {q.statement}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                                <span className="px-2 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8]">
                                  {q.category}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8]">
                                  {q.difficulty}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Option 2: Random by Category */}
                {formData.mcqConfig.mode === "RANDOM" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
                      <strong>Dynamic Random Allocation:</strong> During student contest entry, our backend will randomly sample questions matching these category counts from the live database. Each student receives a unique randomized set.
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {formData.mcqConfig.randomRules.map((rule, idx) => (
                        <div
                          key={rule.category}
                          className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-xl space-y-2"
                        >
                          <span className="text-xs font-bold text-[#0f172a] dark:text-white uppercase font-mono">
                            {rule.category} MCQs
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={rule.count}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setFormData((p) => {
                                const copy = [...p.mcqConfig.randomRules];
                                copy[idx] = { ...copy[idx], count: val };
                                return {
                                  ...p,
                                  mcqConfig: { ...p.mcqConfig, randomRules: copy },
                                };
                              });
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-xs font-mono font-bold text-[#0f172a] dark:text-white text-center"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-right text-xs font-mono font-semibold text-purple-600 dark:text-purple-400">
                      Total Random MCQs to Generate: {mcqRandomTotal} questions
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Coding Section Configuration (when enabled) */}
            {formData.hasCoding && (
              <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                  <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>4. Programming / Coding Section Configuration</span>
                  </h2>

                  {/* Mode Tabs */}
                  <div className="flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          codingConfig: { ...p.codingConfig, mode: "MANUAL" },
                        }))
                      }
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        formData.codingConfig.mode === "MANUAL"
                          ? "bg-white dark:bg-[#1a2233] text-emerald-600 dark:text-emerald-400 shadow-xs"
                          : "text-[#64748b] dark:text-[#94a3b8]"
                      }`}
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>1. Select from Database List ({formData.codingConfig.questionIds.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          codingConfig: { ...p.codingConfig, mode: "RANDOM" },
                        }))
                      }
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        formData.codingConfig.mode === "RANDOM"
                          ? "bg-white dark:bg-[#1a2233] text-purple-600 dark:text-purple-400 shadow-xs"
                          : "text-[#64748b] dark:text-[#94a3b8]"
                      }`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>2. Random by Difficulty ({codingRandomTotal})</span>
                    </button>
                  </div>
                </div>

                {/* Option 1: Manual List Picker from Database */}
                {formData.codingConfig.mode === "MANUAL" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="w-3.5 h-3.5 text-[#64748b] dark:text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search DB coding problems..."
                            value={codingSearch}
                            onChange={(e) => setCodingSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white"
                          />
                        </div>

                        <select
                          value={codingDifficultyFilter}
                          onChange={(e) => setCodingDifficultyFilter(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs text-[#0f172a] dark:text-white font-mono"
                        >
                          <option value="ALL">All Difficulties</option>
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              codingConfig: { ...p.codingConfig, questionIds: [] },
                            }))
                          }
                          className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Coding Questions List */}
                    <div className="max-h-72 overflow-y-auto border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                      {loadingDbCoding ? (
                        <div className="p-8 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                          Loading database problems...
                        </div>
                      ) : filteredDbCoding.length === 0 ? (
                        <div className="p-8 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                          No coding problems match the filter.
                        </div>
                      ) : (
                        filteredDbCoding.map((q) => {
                          const isSelected = formData.codingConfig.questionIds.includes(q.id);
                          return (
                            <div
                              key={q.id}
                              onClick={() => toggleCodingQuestion(q.id)}
                              className={`p-3 text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-emerald-500/10 dark:bg-emerald-500/15"
                                  : "hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-4 h-4 rounded-md flex items-center justify-center ${
                                    isSelected
                                      ? "bg-emerald-600 text-white"
                                      : "border border-slate-300 dark:border-slate-600"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3" />}
                                </div>
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-[#0f172a] dark:text-white">
                                    {q.title}
                                  </span>
                                  <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-mono block">
                                    slug: {q.slug}
                                  </span>
                                </div>
                              </div>

                              <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8]">
                                {q.difficulty}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Option 2: Random by Difficulty */}
                {formData.codingConfig.mode === "RANDOM" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20 text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
                      <strong>Dynamic Random Allocation:</strong> During student contest entry, our backend will randomly sample problems matching these difficulty quotas directly from the questions database.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {formData.codingConfig.randomRules.map((rule, idx) => (
                        <div
                          key={rule.difficulty}
                          className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-xl space-y-2"
                        >
                          <span className="text-xs font-bold text-[#0f172a] dark:text-white uppercase font-mono">
                            {rule.difficulty} Problems
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            value={rule.count}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setFormData((p) => {
                                const copy = [...p.codingConfig.randomRules];
                                copy[idx] = { ...copy[idx], count: val };
                                return {
                                  ...p,
                                  codingConfig: { ...p.codingConfig, randomRules: copy },
                                };
                              });
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-xs font-mono font-bold text-[#0f172a] dark:text-white text-center"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-right text-xs font-mono font-semibold text-purple-600 dark:text-purple-400">
                      Total Random Coding Challenges: {codingRandomTotal} problems
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. Live Summary & Submission Bar */}
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-[#121824] dark:to-[#1a2233] border border-purple-500/30 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-purple-600 dark:text-purple-400">
                  Assessment Structure Preview
                </span>
                <div className="text-sm font-bold text-[#0f172a] dark:text-white">
                  {formData.hasMcq ? `${formData.mcqConfig.mode === "MANUAL" ? formData.mcqConfig.questionIds.length : mcqRandomTotal} MCQs` : "0 MCQs"} +{" "}
                  {formData.hasCoding ? `${formData.codingConfig.mode === "MANUAL" ? formData.codingConfig.questionIds.length : codingRandomTotal} Coding Problems` : "0 Coding"} · {calculatedTotalPoints} Total Points · {formData.durationMinutes} Mins
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Publishing Assessment..." : "Save & Publish Contest"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
