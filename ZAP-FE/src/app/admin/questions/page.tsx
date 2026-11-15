"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  Users,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Sliders,
  Sparkles,
  Layers,
  Eye,
  Lock,
  FileJson,
  Check,
} from "lucide-react";
import { getStoredStudent } from "@/services/authApi";
import { adminApi } from "@/services/adminApi";
import { questionsApi } from "@/services/questionsApi";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Student } from "@/types/auth";
import {
  Question,
  QuestionSummary,
  QuestionFormData,
  TestCase,
  Difficulty,
  QuestionStatus,
  TestCaseVisibility,
  DEFAULT_STARTER_CODE,
  EMPTY_QUESTION_FORM,
} from "@/types/question";

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "text-[#047857] dark:text-[#34d399] bg-[#ecfdf5] dark:bg-[#10b981]/15 border-[#a7f3d0] dark:border-[#10b981]/25",
  MEDIUM: "text-[#b45309] dark:text-[#fbbf24] bg-[#fffbeb] dark:bg-[#f59e0b]/15 border-[#fde68a] dark:border-[#f59e0b]/25",
  HARD: "text-[#b91c1c] dark:text-[#fb7185] bg-[#fef2f2] dark:bg-[#f43f5e]/15 border-[#fecaca] dark:border-[#f43f5e]/25",
};

const STATUS_BADGE: Record<string, string> = {
  PUBLISHED: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
  DRAFT: "text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#1a2233] border-[#e2e8f0] dark:border-[#232f45]",
  ARCHIVED: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
};

const ALL_LANGUAGES = [
  { id: "python", label: "Python 3" },
  { id: "node", label: "JavaScript (Node)" },
  { id: "java", label: "Java 21" },
  { id: "cpp", label: "C++ 23" },
  { id: "c", label: "C" },
];

type ModalTab = "basic" | "statement" | "limits" | "starter" | "testcases" | "json";

export default function AdminQuestionsPage() {
  const router = useRouter();

  // Auth & Admin state
  const [student, setStudent] = useState<Student | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Questions state
  const [questions, setQuestions] = useState<QuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal (Create / Edit) state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("basic");
  const [form, setForm] = useState<QuestionFormData>(EMPTY_QUESTION_FORM);
  const [tagInput, setTagInput] = useState("");
  const [constraintInput, setConstraintInput] = useState("");
  const [activeStarterLang, setActiveStarterLang] = useState<string>("python");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Raw JSON state in modal
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState<QuestionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Trigger feedback toast
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  }, []);

  // 1. Verify Authentication & Admin Status
  useEffect(() => {
    const currentStudent = getStoredStudent();
    setStudent(currentStudent);
    if (!currentStudent?.email) {
      setAuthChecking(false);
      setIsAdmin(false);
      return;
    }

    let isMounted = true;
    adminApi
      .checkAdmin(currentStudent.email)
      .then((allowed) => {
        if (!isMounted) return;
        setIsAdmin(allowed);
        setAuthChecking(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAdmin(false);
        setAuthChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Questions
  const fetchQuestions = useCallback(async () => {
    if (!student?.email || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all questions regardless of status (summary view)
      const data = await questionsApi.list(undefined, true);
      setQuestions(data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load questions. Ensure the backend server is reachable."
      );
    } finally {
      setLoading(false);
    }
  }, [student, isAdmin]);

  useEffect(() => {
    if (!authChecking && isAdmin) {
      fetchQuestions();
    }
  }, [authChecking, isAdmin, fetchQuestions]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = questions.length;
    let easy = 0;
    let medium = 0;
    let hard = 0;
    let published = 0;
    let draft = 0;

    questions.forEach((q) => {
      if (q.difficulty === "EASY") easy++;
      else if (q.difficulty === "MEDIUM") medium++;
      else if (q.difficulty === "HARD") hard++;

      if (q.status === "PUBLISHED") published++;
      else if (q.status === "DRAFT") draft++;
    });

    return { total, easy, medium, hard, published, draft };
  }, [questions]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (difficultyFilter !== "ALL" && q.difficulty !== difficultyFilter) return false;
      if (statusFilter !== "ALL" && q.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;

      const qLow = searchQuery.toLowerCase().trim();
      const titleMatch = q.title?.toLowerCase().includes(qLow);
      const slugMatch = q.slug?.toLowerCase().includes(qLow);
      const tagMatch = q.tags?.some((t) => t.toLowerCase().includes(qLow));

      return titleMatch || slugMatch || tagMatch;
    });
  }, [questions, difficultyFilter, statusFilter, searchQuery]);

  // Handlers for Form updates
  const updateForm = <K extends keyof QuestionFormData>(key: K, value: QuestionFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleTitleChange = (val: string) => {
    updateForm("title", val);
    // Auto-slug generation when in create mode and slug hasn't been manually diverged
    if (modalMode === "create") {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      updateForm("slug", generatedSlug);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      updateForm("tags", [...form.tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateForm("tags", form.tags.filter((t) => t !== tag));
  };

  const addConstraint = () => {
    const c = constraintInput.trim();
    if (c) {
      updateForm("constraints", [...form.constraints, c]);
    }
    setConstraintInput("");
  };

  const removeConstraint = (idx: number) => {
    updateForm(
      "constraints",
      form.constraints.filter((_, i) => i !== idx)
    );
  };

  const addTestCase = () => {
    const newCase: TestCase = {
      id: `tc-${Date.now()}`,
      visibility: "PUBLIC",
      input: "",
      expectedOutput: "",
      enabled: true,
    };
    updateForm("testCases", [...form.testCases, newCase]);
  };

  const updateTestCase = (idx: number, key: keyof TestCase, val: any) => {
    const next = [...form.testCases];
    next[idx] = { ...next[idx], [key]: val };
    updateForm("testCases", next);
  };

  const removeTestCase = (idx: number) => {
    updateForm(
      "testCases",
      form.testCases.filter((_, i) => i !== idx)
    );
  };

  const toggleLanguage = (langId: string) => {
    const current = form.supportedLanguages || [];
    if (current.includes(langId)) {
      if (current.length === 1) return; // Must have at least 1 language
      updateForm(
        "supportedLanguages",
        current.filter((l) => l !== langId)
      );
    } else {
      updateForm("supportedLanguages", [...current, langId]);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode("create");
    setEditingQuestionId(null);
    setForm(EMPTY_QUESTION_FORM);
    setJsonText(JSON.stringify(EMPTY_QUESTION_FORM, null, 2));
    setModalTab("basic");
    setFormError(null);
    setJsonError(null);
    setModalOpen(true);
  };

  // Open Edit Modal (fetches full question by id)
  const openEditModal = async (summary: QuestionSummary) => {
    setModalMode("edit");
    setEditingQuestionId(summary.id);
    setModalTab("basic");
    setFormError(null);
    setJsonError(null);
    setModalOpen(true);

    try {
      const full = await questionsApi.get(summary.id);
      const data: QuestionFormData = {
        slug: full.slug,
        title: full.title,
        difficulty: full.difficulty,
        tags: full.tags || [],
        statement: full.statement || "",
        examples: full.examples || [],
        constraints: full.constraints || [],
        testCases: full.testCases || [],
        executionLimits: full.executionLimits || { timeMs: 2000, memoryMb: 256, outputKb: 1024 },
        supportedLanguages: full.supportedLanguages || ["python", "c", "cpp", "java", "node"],
        starterCode: full.starterCode || DEFAULT_STARTER_CODE,
        status: full.status || "PUBLISHED",
      };
      setForm(data);
      setJsonText(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Failed to load full question details for editing."
      );
    }
  };

  // Sync Form to JSON tab
  const handleTabChange = (tab: ModalTab) => {
    if (tab === "json") {
      setJsonText(JSON.stringify(form, null, 2));
      setJsonError(null);
    }
    setModalTab(tab);
  };

  // Apply JSON changes back to Form
  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.title || !parsed.slug || !parsed.statement) {
        throw new Error("JSON must at least contain 'title', 'slug', and 'statement'.");
      }
      setForm({
        ...EMPTY_QUESTION_FORM,
        ...parsed,
        tags: parsed.tags || [],
        constraints: parsed.constraints || [],
        testCases: parsed.testCases || [],
        executionLimits: { ...EMPTY_QUESTION_FORM.executionLimits, ...(parsed.executionLimits || {}) },
        supportedLanguages: parsed.supportedLanguages || EMPTY_QUESTION_FORM.supportedLanguages,
        starterCode: parsed.starterCode || DEFAULT_STARTER_CODE,
      });
      setJsonError(null);
      showToast("JSON successfully applied to form fields.");
      setModalTab("basic");
    } catch (err: unknown) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON format.");
    }
  };

  // Save (Create or Update) Question
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Basic validation
    if (!form.title.trim()) {
      setFormError("Question title is required.");
      setModalTab("basic");
      return;
    }
    if (!form.slug.trim()) {
      setFormError("URL slug is required.");
      setModalTab("basic");
      return;
    }
    if (!form.statement.trim()) {
      setFormError("Problem statement description is required.");
      setModalTab("statement");
      return;
    }
    if (!form.testCases || form.testCases.length === 0) {
      setFormError("At least one test case must be defined for evaluation.");
      setModalTab("testcases");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        const created = await questionsApi.create(form);
        showToast(`Challenge "${created.title}" successfully created!`);
      } else if (modalMode === "edit" && editingQuestionId) {
        const updated = await questionsApi.update(editingQuestionId, form);
        showToast(`Challenge "${updated.title}" successfully updated!`);
      }
      setModalOpen(false);
      await fetchQuestions();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to save question. Check server logs or connection."
      );
    } finally {
      setSaving(false);
    }
  };

  // Open Delete Confirmation
  const confirmDelete = (q: QuestionSummary) => {
    setDeletingQuestion(q);
    setDeleteModalOpen(true);
  };

  // Execute Deletion
  const handleDeleteQuestion = async () => {
    if (!deletingQuestion) return;
    setDeleting(true);
    try {
      await questionsApi.delete(deletingQuestion.id);
      showToast(`Challenge "${deletingQuestion.title}" deleted.`);
      setDeleteModalOpen(false);
      setDeletingQuestion(null);
      setQuestions((prev) => prev.filter((item) => item.id !== deletingQuestion.id));
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? `Delete failed: ${err.message}` : "Failed to delete question."
      );
    } finally {
      setDeleting(false);
    }
  };

  // -------------------------------------------------------------
  // Render View States: Checking Auth, Unauthenticated, Forbidden
  // -------------------------------------------------------------

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-6 text-[#0f172a] dark:text-[#f8fafc]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600 dark:text-purple-400" />
          <p className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] tracking-wide">
            Verifying administrative access permissions...
          </p>
        </div>
      </div>
    );
  }

  if (!student?.email) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-6 text-[#0f172a] dark:text-[#f8fafc]">
        <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 text-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold mb-2">Administrator Authentication Required</h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-6 leading-relaxed">
            Please log in with an administrator account to manage question challenges, starter templates, and test cases.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/30"
            >
              Log In to Continue
            </Link>
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center py-2 px-4 rounded-xl text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white transition-colors"
            >
              Back to Arena
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-6 text-[#0f172a] dark:text-[#f8fafc]">
        <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 text-center shadow-lg">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold mb-2">Access Restricted (403)</h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3 leading-relaxed">
            The account <strong className="text-[#0f172a] dark:text-white font-mono">{student.email}</strong> is not listed in the platform administrator collection.
          </p>
          <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mb-6">
            If you need administrative privileges to author or manage questions, please contact the platform administrator.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center py-2.5 px-5 rounded-xl text-xs font-semibold text-[#0f172a] dark:text-white bg-[#f1f5f9] dark:bg-[#1a2233] hover:bg-[#e2e8f0] dark:hover:bg-[#232f45] border border-[#e2e8f0] dark:border-[#232f45] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
            Back to Arena
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Authorized Admin View: Full Question Management Console
  // -------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-200">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0f172a] text-white dark:bg-white dark:text-[#0f172a] px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border border-white/10 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md flex-shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand & Admin Navigation */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shadow-blue-600/30">
                Z
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight select-none text-[#0f172a] dark:text-white">
                  ZAP
                </span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Admin
                </span>
              </div>
            </Link>

            {/* Admin Segmented Subnavigation */}
            <nav className="hidden sm:flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <Link
                href="/admin/users"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white transition-colors"
                title="Student Performance & Cohort Analytics"
              >
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Users Dashboard</span>
              </Link>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]">
                <Code2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Questions Manager</span>
                {questions.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                    {questions.length}
                  </span>
                )}
              </div>
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#1a2233] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] text-xs font-medium text-[#475569] dark:text-[#cbd5e1] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Return to Arena</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs">
              <span className="w-4 h-4 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white truncate max-w-[130px]">
                {student.name}
              </span>
            </div>

            <EnvironmentSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col gap-6">
        {/* Page Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
                Question Bank &amp; Problem Management
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Admin Console
              </span>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Author new challenges, update problem specifications, calibrate test cases, and manage lifecycle status.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={fetchQuestions}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] text-[#475569] dark:text-[#cbd5e1] transition-colors shadow-xs"
              title="Refresh Question Bank"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-purple-500" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchQuestions}
              className="font-bold underline hover:no-underline text-xs flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Questions */}
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">Total Challenges</span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Code2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
              {stats.total}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{stats.published} Published</span>
              <span>·</span>
              <span>{stats.draft} Drafts</span>
            </div>
          </div>

          {/* Easy Questions */}
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">Easy</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <span className="text-xs font-bold font-mono">E</span>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
              {stats.easy}
            </div>
            <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-1.5">
              {stats.total > 0 ? `${Math.round((stats.easy / stats.total) * 100)}% of problem bank` : "0%"}
            </div>
          </div>

          {/* Medium Questions */}
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">Medium</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <span className="text-xs font-bold font-mono">M</span>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
              {stats.medium}
            </div>
            <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-1.5">
              {stats.total > 0 ? `${Math.round((stats.medium / stats.total) * 100)}% of problem bank` : "0%"}
            </div>
          </div>

          {/* Hard Questions */}
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">Hard</span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <span className="text-xs font-bold font-mono">H</span>
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
              {stats.hard}
            </div>
            <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-1.5">
              {stats.total > 0 ? `${Math.round((stats.hard / stats.total) * 100)}% of problem bank` : "0%"}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challenges by title, slug, or #tags..."
              className="w-full pl-9 pr-8 py-2 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl text-xs text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Difficulty Filter */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] p-1 rounded-xl">
              {(["ALL", "EASY", "MEDIUM", "HARD"] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    difficultyFilter === diff
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  {diff === "ALL" ? "All Levels" : diff.charAt(0) + diff.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] p-1 rounded-xl">
              {(["ALL", "PUBLISHED", "DRAFT"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === st
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  {st === "ALL" ? "All Status" : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* Reset Filters button */}
            {(difficultyFilter !== "ALL" || statusFilter !== "ALL" || searchQuery) && (
              <button
                onClick={() => {
                  setDifficultyFilter("ALL");
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                className="text-xs text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white underline px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8] px-1">
            <span>
              Showing <strong className="text-[#0f172a] dark:text-white">{filteredQuestions.length}</strong> of{" "}
              {questions.length} questions
            </span>
            {loading && <span className="animate-pulse">Loading problem bank...</span>}
          </div>

          {filteredQuestions.map((q) => (
            <div
              key={q.id}
              className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-500/40 dark:hover:border-blue-500/30 transition-all shadow-xs group"
            >
              {/* Question Meta & Title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      DIFFICULTY_BADGE[q.difficulty] || DIFFICULTY_BADGE["MEDIUM"]
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      STATUS_BADGE[q.status] || STATUS_BADGE["DRAFT"]
                    }`}
                  >
                    {q.status}
                  </span>

                  <span className="text-[10px] font-mono text-[#64748b] dark:text-[#94a3b8] bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] px-2 py-0.5 rounded-md">
                    v{q.version}
                  </span>

                  {q.tags?.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] text-[#64748b] dark:text-[#94a3b8] bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] px-2 py-0.5 rounded-md font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-baseline gap-2.5 mb-1.5 flex-wrap">
                  <h3
                    onClick={() => openEditModal(q)}
                    className="text-base font-bold text-[#0f172a] dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                  >
                    {q.title}
                  </h3>
                  <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                    /{q.slug}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#64748b] dark:text-[#94a3b8] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>{q.testCasesCount ?? 0} test cases</span>
                  </span>
                  <span>·</span>
                  <span>Languages: {(q.supportedLanguages || ["python", "c", "cpp", "java", "node"]).join(", ")}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#e2e8f0] dark:border-[#1e293b]">
                <Link
                  href={`/?problem=${encodeURIComponent(q.slug)}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] text-[#475569] dark:text-[#cbd5e1] transition-colors"
                  title="Test solve this problem in student Arena"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Arena</span>
                </Link>

                <button
                  type="button"
                  onClick={() => openEditModal(q)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-blue-500/25 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                  title="Update question specifications and test cases"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => confirmDelete(q)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                  title="Delete question permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}

          {filteredQuestions.length === 0 && !loading && (
            <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-12 text-center shadow-xs">
              <Code2 className="w-12 h-12 text-[#94a3b8] mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-bold text-[#0f172a] dark:text-white mb-1">
                No matching questions found
              </h3>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-sm mx-auto mb-5 leading-relaxed">
                {searchQuery || difficultyFilter !== "ALL" || statusFilter !== "ALL"
                  ? "Try clearing your filters or searching with a different term."
                  : "Your question bank is empty. Get started by adding your first coding challenge."}
              </p>
              {searchQuery || difficultyFilter !== "ALL" || statusFilter !== "ALL" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDifficultyFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#f1f5f9] dark:bg-[#1a2233] text-[#0f172a] dark:text-white hover:bg-[#e2e8f0] dark:hover:bg-[#232f45] transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Your First Challenge</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* Question Editor Modal (Create & Update)                    */}
      {/* ========================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between gap-4 bg-[#f8fafc]/50 dark:bg-[#0e1420]/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
                    {modalMode === "create" ? "Create New Challenge" : `Edit Challenge: ${form.title || "Untitled"}`}
                  </h2>
                </div>
                <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                  Configure problem statements, test cases, starter code, and execution limits.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Bar */}
            <div className="px-6 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc]/30 dark:bg-[#0e1420]/30 flex items-center gap-1 overflow-x-auto text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleTabChange("basic")}
                className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "basic"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Basic Info</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("statement")}
                className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "statement"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Statement &amp; Constraints</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("testcases")}
                className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "testcases"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Test Cases ({form.testCases.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("limits")}
                className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "limits"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Limits &amp; Languages</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("starter")}
                className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "starter"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Starter Code</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange("json")}
                className={`py-3 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  modalTab === "json"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveQuestion} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Error Alert inside modal */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* TAB 1: BASIC INFO */}
              {modalTab === "basic" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                        Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="e.g. Two Sum"
                        className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                        URL Slug <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        value={form.slug}
                        onChange={(e) =>
                          updateForm(
                            "slug",
                            e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-")
                          )
                        }
                        placeholder="e.g. two-sum"
                        className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs font-mono text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                        Difficulty
                      </label>
                      <select
                        value={form.difficulty}
                        onChange={(e) => updateForm("difficulty", e.target.value as Difficulty)}
                        className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                        Status
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => updateForm("status", e.target.value as QuestionStatus)}
                        className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="PUBLISHED">Published (Visible in Arena)</option>
                        <option value="DRAFT">Draft (Hidden from students)</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                      Topic Tags
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Type a tag name (e.g. array, hash-table) and press Enter"
                        className="flex-1 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3.5 py-2 bg-[#f1f5f9] dark:bg-[#1a2233] hover:bg-[#e2e8f0] dark:hover:bg-[#232f45] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl text-xs font-semibold transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                      {form.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] text-[#0f172a] dark:text-white text-xs px-2.5 py-1 rounded-lg font-mono"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="text-[#94a3b8] hover:text-rose-500 ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {form.tags.length === 0 && (
                        <span className="text-[11px] text-[#94a3b8] italic">No tags added yet.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STATEMENT & CONSTRAINTS */}
              {modalTab === "statement" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                      Problem Statement (Markdown Supported) <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={9}
                      value={form.statement}
                      onChange={(e) => updateForm("statement", e.target.value)}
                      placeholder="Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target..."
                      className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl p-3 text-xs font-mono text-[#0f172a] dark:text-white resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#475569] dark:text-[#cbd5e1] mb-1.5">
                      Constraints
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={constraintInput}
                        onChange={(e) => setConstraintInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addConstraint();
                          }
                        }}
                        placeholder="e.g. 2 <= nums.length <= 10^4"
                        className="flex-1 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs font-mono text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addConstraint}
                        className="px-3.5 py-2 bg-[#f1f5f9] dark:bg-[#1a2233] hover:bg-[#e2e8f0] dark:hover:bg-[#232f45] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl text-xs font-semibold transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {form.constraints.map((c, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-lg text-xs font-mono text-[#0f172a] dark:text-white"
                        >
                          <span>• {c}</span>
                          <button
                            type="button"
                            onClick={() => removeConstraint(idx)}
                            className="text-[#94a3b8] hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {form.constraints.length === 0 && (
                        <p className="text-[11px] text-[#94a3b8] italic">No constraints listed.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TEST CASES */}
              {modalTab === "testcases" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                        Test Cases Evaluation Suite
                      </h4>
                      <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                        Define sample tests visible to candidates and hidden test cases for judge grading.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addTestCase}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Test Case</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.testCases.map((tc, idx) => (
                      <div
                        key={tc.id || idx}
                        className="bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#0f172a] dark:text-white">
                              Case #{idx + 1}
                            </span>

                            {/* Visibility Badge Toggle */}
                            <button
                              type="button"
                              onClick={() =>
                                updateTestCase(
                                  idx,
                                  "visibility",
                                  tc.visibility === "PUBLIC" ? "HIDDEN" : "PUBLIC"
                                )
                              }
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                                tc.visibility === "PUBLIC"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              }`}
                              title="Click to toggle Public / Hidden"
                            >
                              {tc.visibility === "PUBLIC" ? (
                                <>
                                  <Eye className="w-3 h-3" />
                                  <span>PUBLIC (Sample)</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  <span>HIDDEN (Evaluation)</span>
                                </>
                              )}
                            </button>

                            {/* Enabled Toggle */}
                            <label className="flex items-center gap-1.5 text-xs text-[#64748b] dark:text-[#94a3b8] cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={tc.enabled}
                                onChange={(e) => updateTestCase(idx, "enabled", e.target.checked)}
                                className="rounded text-blue-600 focus:ring-0"
                              />
                              <span>Enabled</span>
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeTestCase(idx)}
                            className="text-[#94a3b8] hover:text-rose-500 p-1"
                            title="Remove Test Case"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                              Input (stdin / function arguments)
                            </label>
                            <textarea
                              rows={3}
                              value={tc.input}
                              onChange={(e) => updateTestCase(idx, "input", e.target.value)}
                              placeholder="[2,7,11,15]&#10;9"
                              className="w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg p-2.5 text-xs font-mono text-[#0f172a] dark:text-white resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                              Expected Output
                            </label>
                            <textarea
                              rows={3}
                              value={tc.expectedOutput}
                              onChange={(e) =>
                                updateTestCase(idx, "expectedOutput", e.target.value)
                              }
                              placeholder="[0, 1]"
                              className="w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg p-2.5 text-xs font-mono text-[#0f172a] dark:text-white resize-y focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {form.testCases.length === 0 && (
                      <div className="p-8 text-center border-2 border-dashed border-[#e2e8f0] dark:border-[#232f45] rounded-xl text-xs text-[#94a3b8]">
                        <p className="mb-2">No test cases have been added.</p>
                        <button
                          type="button"
                          onClick={addTestCase}
                          className="font-bold text-blue-600 dark:text-blue-400 underline"
                        >
                          + Add a Test Case
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: LIMITS & LANGUAGES */}
              {modalTab === "limits" && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white mb-2">
                      Execution Resource Bounds
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                          Time Limit (ms)
                        </label>
                        <input
                          type="number"
                          value={form.executionLimits.timeMs}
                          onChange={(e) =>
                            updateForm("executionLimits", {
                              ...form.executionLimits,
                              timeMs: Number(e.target.value) || 2000,
                            })
                          }
                          className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs font-mono text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                          Memory Limit (MB)
                        </label>
                        <input
                          type="number"
                          value={form.executionLimits.memoryMb}
                          onChange={(e) =>
                            updateForm("executionLimits", {
                              ...form.executionLimits,
                              memoryMb: Number(e.target.value) || 256,
                            })
                          }
                          className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs font-mono text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                          Max Output Limit (KB)
                        </label>
                        <input
                          type="number"
                          value={form.executionLimits.outputKb}
                          onChange={(e) =>
                            updateForm("executionLimits", {
                              ...form.executionLimits,
                              outputKb: Number(e.target.value) || 1024,
                            })
                          }
                          className="w-full bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl px-3 py-2 text-xs font-mono text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white mb-2">
                      Supported Compiler &amp; Runner Languages
                    </h4>
                    <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mb-3">
                      Select which languages candidates are allowed to write solutions in for this problem.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {ALL_LANGUAGES.map((lang) => {
                        const isChecked = form.supportedLanguages?.includes(lang.id);
                        return (
                          <div
                            key={lang.id}
                            onClick={() => toggleLanguage(lang.id)}
                            className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all select-none ${
                              isChecked
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                                : "bg-[#f8fafc] dark:bg-[#0e1420] border-[#e2e8f0] dark:border-[#232f45] text-[#64748b] dark:text-[#94a3b8]"
                            }`}
                          >
                            <span className="text-xs font-semibold">{lang.label}</span>
                            <div
                              className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                                isChecked
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "border-[#94a3b8]"
                              }`}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: STARTER CODE */}
              {modalTab === "starter" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                        Starter Code Templates
                      </h4>
                      <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                        Pre-populate standard solution classes and function signatures for each language.
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#232f45] p-1 rounded-xl">
                      {(form.supportedLanguages || ["python"]).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setActiveStarterLang(lang)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                            activeStarterLang === lang
                              ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                              : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={12}
                    value={form.starterCode?.[activeStarterLang] ?? ""}
                    onChange={(e) =>
                      updateForm("starterCode", {
                        ...(form.starterCode || {}),
                        [activeStarterLang]: e.target.value,
                      })
                    }
                    className="w-full bg-[#0b0f17] border border-[#1e293b] rounded-xl p-3 text-xs font-mono text-emerald-400 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>
              )}

              {/* TAB 6: RAW JSON */}
              {modalTab === "json" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                      View, export, or directly edit the full question JSON specification.
                    </p>
                    <button
                      type="button"
                      onClick={handleApplyJson}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                      Apply JSON to Form
                    </button>
                  </div>

                  {jsonError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-500 text-xs">
                      {jsonError}
                    </div>
                  )}

                  <textarea
                    rows={15}
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    className="w-full bg-[#0b0f17] border border-[#1e293b] rounded-xl p-3 text-xs font-mono text-sky-300 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  />
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] text-[#475569] dark:text-[#cbd5e1] transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-sm shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving challenge...</span>
                    </>
                  ) : (
                    <span>{modalMode === "create" ? "Create Challenge" : "Save Changes"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* Delete Confirmation Modal                                 */}
      {/* ========================================================= */}
      {deleteModalOpen && deletingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-[#0f172a] dark:text-white mb-2">
              Delete Question Challenge?
            </h3>

            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-4 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-[#0f172a] dark:text-white">
                &ldquo;{deletingQuestion.title}&rdquo;
              </strong>{" "}
              (<span className="font-mono">{deletingQuestion.slug}</span>)?
            </p>

            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-left text-[11px] text-rose-600 dark:text-rose-400 mb-6 leading-relaxed">
              <strong>Warning:</strong> This will remove the question and all configured test cases from student and faculty views. This action cannot be undone.
            </div>

            <div className="flex items-center gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeletingQuestion(null);
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] text-[#475569] dark:text-[#cbd5e1] transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteQuestion}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Question</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

