"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Users,
  Code2,
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
  FileText,
  Code,
  Image as ImageIcon,
  Sparkles,
  Layers,
  Eye,
  Check,
  FileJson,
  Database,
  Network,
  Cpu,
  BookOpen,
  Sliders,
  Trophy,
} from "lucide-react";
import { getStoredStudent } from "@/services/authApi";
import { adminApi } from "@/services/adminApi";
import { mcqApi } from "@/services/mcqApi";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminHeader } from "@/components/AdminHeader";
import type { Student } from "@/types/auth";
import {
  MCQQuestion,
  MCQQuestionSummary,
  MCQFormData,
  MCQOption,
  Difficulty,
  QuestionStatus,
  ContentType,
  EMPTY_MCQ_FORM,
} from "@/types/mcq";

const CATEGORY_STYLES: Record<string, { label: string; badge: string; icon: any }> = {
  DSA: {
    label: "DSA",
    badge: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800",
    icon: Code2,
  },
  DBMS: {
    label: "DBMS",
    badge: "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800",
    icon: Database,
  },
  NETWORKS: {
    label: "Networks",
    badge: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    icon: Network,
  },
  OOPS: {
    label: "OOPS",
    badge: "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
    icon: Cpu,
  },
  OS: {
    label: "OS",
    badge: "text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800",
    icon: Layers,
  },
};

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

const CODE_LANGUAGES = [
  { id: "python", label: "Python 3" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "sql", label: "SQL" },
  { id: "javascript", label: "JavaScript" },
  { id: "c", label: "C" },
];

type ModalTab = "details" | "content" | "options" | "json";

export default function AdminMCQPage() {
  const router = useRouter();

  // Current session & auth
  const [student, setStudent] = useState<Student | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Questions state
  const [questions, setQuestions] = useState<MCQQuestionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Filters & search
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<ModalTab>("details");
  const [form, setForm] = useState<MCQFormData>(EMPTY_MCQ_FORM);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<MCQQuestionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Student Preview Modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<MCQQuestion | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewSelectedOption, setPreviewSelectedOption] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 4000);
  }, []);

  // Verify auth & admin access
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

  // Fetch MCQ list
  const fetchQuestions = useCallback(async () => {
    if (!student?.email || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await mcqApi.list(
        selectedCategory,
        selectedDifficulty,
        selectedStatus,
        searchQuery,
        true
      );
      setQuestions(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load MCQ questions.");
    } finally {
      setLoading(false);
    }
  }, [student?.email, isAdmin, selectedCategory, selectedDifficulty, selectedStatus, searchQuery]);

  useEffect(() => {
    if (isAdmin) {
      fetchQuestions();
    }
  }, [isAdmin, fetchQuestions]);

  // Compute category stats
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      TOTAL: questions.length,
      DSA: 0,
      DBMS: 0,
      NETWORKS: 0,
      OOPS: 0,
      OTHER: 0,
    };
    questions.forEach((q) => {
      const cat = (q.category || "DSA").toUpperCase();
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.OTHER++;
      }
    });
    return counts;
  }, [questions]);

  // Seed default questions
  const handleSeedQuestions = async (force: boolean = false) => {
    setSeeding(true);
    try {
      const res = await mcqApi.seed(force);
      showToast(`Successfully seeded ${res.seeded} questions. Total MCQs: ${res.total}`);
      await fetchQuestions();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to seed default questions.");
    } finally {
      setSeeding(false);
    }
  };

  // Form manipulation helpers
  const updateForm = <K extends keyof MCQFormData>(key: K, val: MCQFormData[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      try {
        setJsonText(JSON.stringify(next, null, 2));
      } catch { }
      return next;
    });
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !form.tags.includes(trimmed)) {
      updateForm("tags", [...form.tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateForm("tags", form.tags.filter((t) => t !== tag));
  };

  // Option management
  const updateOption = (idx: number, patch: Partial<MCQOption>) => {
    const next = [...form.options];
    next[idx] = { ...next[idx], ...patch };
    updateForm("options", next);
  };

  const setCorrectOption = (idx: number) => {
    const next = form.options.map((opt, i) => ({
      ...opt,
      isCorrect: i === idx,
    }));
    updateForm("options", next);
  };

  const addOption = () => {
    const labelChar = String.fromCharCode(65 + form.options.length);
    const newOpt: MCQOption = {
      id: `opt-${Date.now()}-${form.options.length + 1}`,
      type: "text",
      text: "",
      code: "",
      codeLanguage: "python",
      imageUrl: "",
      isCorrect: form.options.length === 0,
      explanation: "",
    };
    updateForm("options", [...form.options, newOpt]);
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) return;
    const next = form.options.filter((_, i) => i !== idx);
    // Ensure at least one is correct
    if (!next.some((o) => o.isCorrect) && next.length > 0) {
      next[0].isCorrect = true;
    }
    updateForm("options", next);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode("create");
    setEditingId(null);
    setForm(EMPTY_MCQ_FORM);
    setJsonText(JSON.stringify(EMPTY_MCQ_FORM, null, 2));
    setModalTab("details");
    setFormError(null);
    setJsonError(null);
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = async (summary: MCQQuestionSummary) => {
    setModalMode("edit");
    setEditingId(summary.id);
    setModalTab("details");
    setFormError(null);
    setJsonError(null);
    setModalOpen(true);

    try {
      const full = await mcqApi.get(summary.id);
      const formData: MCQFormData = {
        title: full.title,
        slug: full.slug || "",
        category: full.category || "DSA",
        difficulty: full.difficulty,
        tags: full.tags || [],
        questionType: full.questionType || "text",
        statement: full.statement || "",
        codeSnippet: full.codeSnippet || "",
        codeLanguage: full.codeLanguage || "python",
        imageUrl: full.imageUrl || "",
        options: full.options || [],
        explanation: full.explanation || "",
        points: full.points || 1,
        status: full.status || "PUBLISHED",
      };
      setForm(formData);
      setJsonText(JSON.stringify(formData, null, 2));
    } catch (err: unknown) {
      setFormError("Failed to fetch full question details.");
    }
  };

  // Open Preview Modal
  const openPreviewModal = async (summary: MCQQuestionSummary) => {
    setLoadingPreview(true);
    setPreviewQuestion(null);
    setPreviewSelectedOption(null);
    setShowExplanation(false);
    setPreviewModalOpen(true);

    try {
      const full = await mcqApi.get(summary.id);
      setPreviewQuestion(full);
    } catch (err: unknown) {
      showToast("Failed to load question preview.");
      setPreviewModalOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Save (Create or Update)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!form.title.trim()) {
      setFormError("Question title is required.");
      setModalTab("details");
      return;
    }
    if (!form.statement.trim()) {
      setFormError("Question statement is required.");
      setModalTab("content");
      return;
    }
    if (!form.options || form.options.length < 2) {
      setFormError("At least 2 options must be provided.");
      setModalTab("options");
      return;
    }
    if (!form.options.some((o) => o.isCorrect)) {
      setFormError("At least one option must be marked as the correct answer.");
      setModalTab("options");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        const created = await mcqApi.create(form);
        showToast(`MCQ "${created.title}" successfully created!`);
      } else if (modalMode === "edit" && editingId) {
        const updated = await mcqApi.update(editingId, form);
        showToast(`MCQ "${updated.title}" successfully updated!`);
      }
      setModalOpen(false);
      await fetchQuestions();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to save question.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!questionToDelete) return;
    setDeleting(true);
    try {
      await mcqApi.delete(questionToDelete.id);
      showToast(`Question "${questionToDelete.title}" deleted.`);
      setDeleteModalOpen(false);
      setQuestionToDelete(null);
      await fetchQuestions();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete question.");
    } finally {
      setDeleting(false);
    }
  };

  // Apply JSON Edit
  const handleApplyJson = () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonText);
      setForm((prev) => ({ ...prev, ...parsed }));
      showToast("Form updated from JSON.");
    } catch (err: unknown) {
      setJsonError("Invalid JSON format. Please check syntax.");
    }
  };

  // 1. Loading Auth State
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          <p className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
            Verifying administrative access permissions...
          </p>
        </div>
      </div>
    );
  }

  // 2. Not Logged In
  if (!student) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-white mb-2">
            Authentication Required
          </h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-6 leading-relaxed">
            Please log in with an administrator account to manage MCQ questions.
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

  // 3. Unauthorized
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

  // 4. Authorized Admin View
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-200">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#0f172a] text-white dark:bg-white dark:text-[#0f172a] px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border border-white/10 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Admin Navigation Header */}
      <AdminHeader
        activeSection="studio"
        activeItem="mcq"
        mcqCount={questions.length}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col gap-6">
        {/* Title & Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">
                MCQ Questions Manager
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                {questions.length} Questions
              </span>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              Author, update, and manage technical multiple-choice questions across DSA, DBMS, Computer Networks, and OOPS. Supports text, code snippets, and image options.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSeedQuestions(false)}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#475569] dark:text-[#cbd5e1] bg-white dark:bg-[#121824] hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#1e293b] transition-colors shadow-xs disabled:opacity-50"
              title="Ensure the 10 standard curated questions exist"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? "animate-spin text-emerald-500" : ""}`} />
              <span>{seeding ? "Seeding..." : "Seed Curated MCQs"}</span>
            </button>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create MCQ Question</span>
            </button>
          </div>
        </div>

        {/* Category Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div
            onClick={() => setSelectedCategory("ALL")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${selectedCategory === "ALL"
                ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20"
                : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] hover:border-blue-400"
              }`}
          >
            <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">All Categories</span>
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-extrabold text-[#0f172a] dark:text-white">
              {categoryCounts.TOTAL}
            </div>
          </div>

          <div
            onClick={() => setSelectedCategory("DSA")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${selectedCategory === "DSA"
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20"
                : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] hover:border-emerald-400"
              }`}
          >
            <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">DSA</span>
              <Code2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {categoryCounts.DSA}
            </div>
          </div>

          <div
            onClick={() => setSelectedCategory("DBMS")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${selectedCategory === "DBMS"
                ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20"
                : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] hover:border-indigo-400"
              }`}
          >
            <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">DBMS</span>
              <Database className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {categoryCounts.DBMS}
            </div>
          </div>

          <div
            onClick={() => setSelectedCategory("NETWORKS")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${selectedCategory === "NETWORKS"
                ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20"
                : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] hover:border-amber-400"
              }`}
          >
            <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Networks</span>
              <Network className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
              {categoryCounts.NETWORKS}
            </div>
          </div>

          <div
            onClick={() => setSelectedCategory("OOPS")}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${selectedCategory === "OOPS"
                ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/20"
                : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] hover:border-purple-400"
              }`}
          >
            <div className="flex items-center justify-between text-[#64748b] dark:text-[#94a3b8] mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">OOPS</span>
              <Cpu className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
              {categoryCounts.OOPS}
            </div>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-[#121824] p-3 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, statement, category, or tags..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#0f172a] dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#0e1420] px-2.5 py-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Category:</span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#0f172a] dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="DSA">DSA</option>
                <option value="DBMS">DBMS</option>
                <option value="NETWORKS">Networks</option>
                <option value="OOPS">OOPS</option>
                <option value="OS">OS</option>
              </select>
            </div>

            {/* Difficulty Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#0e1420] px-2.5 py-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#0f172a] dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#f8fafc] dark:bg-[#0e1420] px-2.5 py-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#0f172a] dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>
        </div>

        {/* Questions Grid / List */}
        {loading ? (
          <div className="bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] p-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin mb-3" />
            <p className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Loading MCQ questions from collection...
            </p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-center text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={fetchQuestions}
              className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-500 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0f172a] dark:text-white mb-1">
              No MCQ Questions Found
            </h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] max-w-sm mb-5">
              {searchQuery || selectedCategory !== "ALL" || selectedDifficulty !== "ALL"
                ? "No questions match your current search and filter criteria."
                : "The mcq_questions database collection is currently empty. Seed default curated questions or create a new one."}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSeedQuestions(true)}
                disabled={seeding}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
              >
                {seeding ? "Seeding..." : "Populate 10 Sample Questions"}
              </button>
              <button
                onClick={openCreateModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#0f172a] dark:text-white bg-[#f1f5f9] dark:bg-[#1a2233] hover:bg-[#e2e8f0] dark:hover:bg-[#232f45] border border-[#e2e8f0] dark:border-[#232f45] transition-colors"
              >
                Create Question
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q) => {
              const catConfig = CATEGORY_STYLES[q.category?.toUpperCase()] || {
                label: q.category || "DSA",
                badge: "text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800",
                icon: BookOpen,
              };
              const CatIcon = catConfig.icon;

              return (
                <div
                  key={q.id}
                  className="bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all p-5 flex flex-col justify-between shadow-xs group"
                >
                  <div>
                    {/* Header: Category, Difficulty, Type, Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Category */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catConfig.badge}`}
                        >
                          <CatIcon className="w-3 h-3" />
                          <span>{catConfig.label}</span>
                        </span>

                        {/* Difficulty */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${DIFFICULTY_BADGE[q.difficulty] || DIFFICULTY_BADGE.EASY
                            }`}
                        >
                          {q.difficulty}
                        </span>

                        {/* Question Type */}
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] px-2 py-0.5 rounded-md">
                          {q.questionType === "code" ? (
                            <>
                              <Code className="w-3 h-3 text-blue-500" />
                              <span>Code</span>
                            </>
                          ) : q.questionType === "image" ? (
                            <>
                              <ImageIcon className="w-3 h-3 text-purple-500" />
                              <span>Image</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3 h-3 text-emerald-500" />
                              <span>Text</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Status */}
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${STATUS_BADGE[q.status] || STATUS_BADGE.PUBLISHED
                          }`}
                      >
                        {q.status}
                      </span>
                    </div>

                    {/* Question Title */}
                    <h3 className="text-sm font-bold text-[#0f172a] dark:text-white line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {q.title}
                    </h3>

                    {/* Statement Preview */}
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] line-clamp-2 mt-1 mb-3 leading-relaxed">
                      {q.statement}
                    </p>

                    {/* Code snippet preview if present */}
                    {q.codeSnippet && (
                      <div className="mb-3 p-2.5 rounded-xl bg-[#0b0f17] border border-[#1e293b] font-mono text-[11px] text-emerald-400 overflow-hidden line-clamp-3">
                        <pre className="whitespace-pre-wrap">{q.codeSnippet}</pre>
                      </div>
                    )}

                    {/* Image preview if present */}
                    {q.imageUrl && (
                      <div className="mb-3 relative rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] h-24 flex items-center justify-center">
                        <img
                          src={q.imageUrl}
                          alt={q.title}
                          className="max-h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    {/* Tags */}
                    {q.tags && q.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mb-3">
                        {q.tags.slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[9px] font-mono text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#0e1420] px-1.5 py-0.5 rounded border border-[#e2e8f0] dark:border-[#1e293b]"
                          >
                            #{t}
                          </span>
                        ))}
                        {q.tags.length > 4 && (
                          <span className="text-[9px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                            +{q.tags.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Options count & Action buttons */}
                  <div className="pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between text-xs">
                    <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">
                      {q.optionsCount} Options ({q.points} pt{q.points > 1 ? "s" : ""})
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openPreviewModal(q)}
                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] transition-colors"
                        title="Student Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => openEditModal(q)}
                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                        title="Edit MCQ"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setQuestionToDelete(q);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title="Delete MCQ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* Create / Edit MCQ Modal                                         */}
      {/* ============================================================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between bg-white dark:bg-[#121824]">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#0f172a] dark:text-white">
                    {modalMode === "create" ? "Create New MCQ Question" : `Edit MCQ: ${form.title}`}
                  </h2>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    Configure statement, category, difficulty, options (text, code, image), and answer keys.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Modal Tabs */}
            <div className="px-6 pt-3 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalTab("details")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === "details"
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#121824]"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>1. Basic Details</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab("content")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === "content"
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#121824]"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>2. Question Content</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab("options")}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === "options"
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#121824]"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>3. Options & Answers ({form.options.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalTab("json");
                  setJsonText(JSON.stringify(form, null, 2));
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-1.5 ${modalTab === "json"
                    ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#121824]"
                    : "border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Body */}
            <form onSubmit={handleSaveQuestion} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* TAB 1: DETAILS */}
              {modalTab === "details" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                      Question Title *
                    </label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => updateForm("title", e.target.value)}
                      placeholder="e.g. Worst-Case Time Complexity of QuickSort"
                      className="w-full px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                        URL Slug (Optional)
                      </label>
                      <input
                        type="text"
                        value={form.slug}
                        onChange={(e) => updateForm("slug", e.target.value)}
                        placeholder="e.g. worst-case-quicksort-complexity"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                        Category Tag *
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {["DSA", "DBMS", "NETWORKS", "OOPS", "OS"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => updateForm("category", c)}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${form.category.toUpperCase() === c
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-[#f8fafc] dark:bg-[#0e1420] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#1e293b]"
                              }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                        Difficulty Level
                      </label>
                      <select
                        value={form.difficulty}
                        onChange={(e) => updateForm("difficulty", e.target.value as Difficulty)}
                        className="w-full px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                        Status
                      </label>
                      <select
                        value={form.status}
                        onChange={(e) => updateForm("status", e.target.value as QuestionStatus)}
                        className="w-full px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="PUBLISHED">Published</option>
                        <option value="DRAFT">Draft</option>
                        <option value="ARCHIVED">Archived</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                        Score Points
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={form.points}
                        onChange={(e) => updateForm("points", parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                      Search Tags
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Add tag and press Enter..."
                        className="flex-1 px-3 py-1.5 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {form.tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#cbd5e1] border border-[#e2e8f0] dark:border-[#232f45]"
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="text-[#94a3b8] hover:text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: QUESTION CONTENT */}
              {modalTab === "content" && (
                <div className="space-y-4">
                  {/* Question Type Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1.5">
                      Question Primary Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => updateForm("questionType", "text")}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${form.questionType === "text"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                            : "border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#0e1420]"
                          }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>Text / Markdown</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateForm("questionType", "code")}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${form.questionType === "code"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                            : "border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#0e1420]"
                          }`}
                      >
                        <Code className="w-4 h-4" />
                        <span>Code Snippet</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateForm("questionType", "image")}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${form.questionType === "image"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                            : "border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f8fafc] dark:hover:bg-[#0e1420]"
                          }`}
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>Image Diagram</span>
                      </button>
                    </div>
                  </div>

                  {/* Statement */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                      Question Statement (Supports Markdown) *
                    </label>
                    <textarea
                      value={form.statement}
                      onChange={(e) => updateForm("statement", e.target.value)}
                      rows={4}
                      placeholder="Enter the question statement or prompt here..."
                      className="w-full px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono leading-relaxed"
                      required
                    />
                  </div>

                  {/* Code Snippet (if code type or populated) */}
                  {(form.questionType === "code" || form.codeSnippet) && (
                    <div className="p-3.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[#0f172a] dark:text-white flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-blue-500" />
                          <span>Code Snippet in Question</span>
                        </label>
                        <select
                          value={form.codeLanguage}
                          onChange={(e) => updateForm("codeLanguage", e.target.value)}
                          className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg text-[#0f172a] dark:text-white"
                        >
                          {CODE_LANGUAGES.map((lang) => (
                            <option key={lang.id} value={lang.id}>
                              {lang.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        value={form.codeSnippet}
                        onChange={(e) => updateForm("codeSnippet", e.target.value)}
                        rows={6}
                        placeholder="// Enter code snippet here..."
                        className="w-full p-3 text-xs bg-[#0b0f17] text-emerald-400 border border-[#1e293b] rounded-xl font-mono leading-relaxed focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Image URL (if image type or populated) */}
                  {(form.questionType === "image" || form.imageUrl) && (
                    <div className="p-3.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] space-y-2">
                      <label className="text-xs font-semibold text-[#0f172a] dark:text-white flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                        <span>Image / Diagram URL</span>
                      </label>
                      <input
                        type="url"
                        value={form.imageUrl}
                        onChange={(e) => updateForm("imageUrl", e.target.value)}
                        placeholder="https://example.com/diagram.svg or image url"
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none"
                      />
                      {form.imageUrl && (
                        <div className="mt-2 p-2 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-center max-h-48 overflow-hidden">
                          <img
                            src={form.imageUrl}
                            alt="Question Diagram Preview"
                            className="max-h-44 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0f172a] dark:text-white mb-1">
                      Explanation of Correct Solution (Shown after student submits)
                    </label>
                    <textarea
                      value={form.explanation}
                      onChange={(e) => updateForm("explanation", e.target.value)}
                      rows={3}
                      placeholder="Explain why the designated option is correct, including asymptotic derivations or RFC references..."
                      className="w-full px-3 py-2 text-xs bg-[#f8fafc] dark:bg-[#0e1420] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: OPTIONS BUILDER */}
              {modalTab === "options" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                    <div>
                      <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                        Multiple Choice Options ({form.options.length})
                      </h4>
                      <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                        Options can be strings, code snippets, or diagrams. Mark one option as the correct answer.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addOption}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      return (
                        <div
                          key={opt.id || idx}
                          className={`p-4 rounded-xl border transition-all ${opt.isCorrect
                              ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700/60 ring-1 ring-emerald-500/20"
                              : "bg-[#f8fafc] dark:bg-[#0e1420] border-[#e2e8f0] dark:border-[#1e293b]"
                            }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            {/* Option Label & Correct Radio */}
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                                {letter}
                              </span>

                              <button
                                type="button"
                                onClick={() => setCorrectOption(idx)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${opt.isCorrect
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "bg-white dark:bg-[#121824] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#1e293b] hover:text-[#0f172a] dark:hover:text-white"
                                  }`}
                              >
                                {opt.isCorrect ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Correct Answer</span>
                                  </>
                                ) : (
                                  <span>Mark as Correct</span>
                                )}
                              </button>
                            </div>

                            {/* Option Type Selector & Delete */}
                            <div className="flex items-center gap-2">
                              <select
                                value={opt.type}
                                onChange={(e) =>
                                  updateOption(idx, { type: e.target.value as ContentType })
                                }
                                className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-lg text-[#0f172a] dark:text-white"
                              >
                                <option value="text">String / Text</option>
                                <option value="code">Code Snippet</option>
                                <option value="image">Image Diagram</option>
                              </select>

                              {form.options.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => removeOption(idx)}
                                  className="p-1 rounded-lg text-[#64748b] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                  title="Delete Option"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Option Content Input according to type */}
                          {opt.type === "text" && (
                            <input
                              type="text"
                              value={opt.text || ""}
                              onChange={(e) => updateOption(idx, { text: e.target.value })}
                              placeholder={`Option ${letter} text string...`}
                              className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none"
                            />
                          )}

                          {opt.type === "code" && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                                  Code Option:
                                </span>
                                <select
                                  value={opt.codeLanguage || "python"}
                                  onChange={(e) =>
                                    updateOption(idx, { codeLanguage: e.target.value })
                                  }
                                  className="px-2 py-0.5 text-[10px] bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded"
                                >
                                  {CODE_LANGUAGES.map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <textarea
                                value={opt.code || ""}
                                onChange={(e) => updateOption(idx, { code: e.target.value })}
                                rows={3}
                                placeholder={`Enter code snippet for Option ${letter}...`}
                                className="w-full p-2.5 text-xs bg-[#0b0f17] text-emerald-400 border border-[#1e293b] rounded-xl font-mono focus:outline-none"
                              />
                            </div>
                          )}

                          {opt.type === "image" && (
                            <div className="space-y-2">
                              <input
                                type="url"
                                value={opt.imageUrl || ""}
                                onChange={(e) => updateOption(idx, { imageUrl: e.target.value })}
                                placeholder={`Option ${letter} image URL...`}
                                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl text-[#0f172a] dark:text-white focus:outline-none"
                              />
                              {opt.imageUrl && (
                                <div className="p-2 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] max-h-28 overflow-hidden flex items-center justify-center">
                                  <img
                                    src={opt.imageUrl}
                                    alt={`Option ${letter}`}
                                    className="max-h-24 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: JSON */}
              {modalTab === "json" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                      Directly import or export question JSON payload:
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyJson}
                      className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
                    >
                      Apply JSON
                    </button>
                  </div>
                  {jsonError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-xs text-rose-600 dark:text-rose-400 border border-rose-200">
                      {jsonError}
                    </div>
                  )}
                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    rows={16}
                    className="w-full p-3 font-mono text-xs bg-[#0b0f17] text-slate-200 border border-[#1e293b] rounded-xl focus:outline-none"
                  />
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm shadow-emerald-600/30 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{modalMode === "create" ? "Create MCQ" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Delete Confirmation Modal                                       */}
      {/* ============================================================== */}
      {deleteModalOpen && questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-center text-[#0f172a] dark:text-white mb-2">
              Delete MCQ Question?
            </h3>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] text-center mb-6 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-[#0f172a] dark:text-white">
                "{questionToDelete.title}"
              </strong>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#1a2233] hover:bg-[#e2e8f0] dark:hover:bg-[#232f45] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Student Interactive Preview Modal                               */}
      {/* ============================================================== */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">
                    Student Experience Preview
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    Test the question interaction, option layout, and answer reveal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748b] hover:text-[#0f172a] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {loadingPreview || !previewQuestion ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin mb-2" />
                  <p className="text-xs text-[#64748b]">Loading question preview...</p>
                </div>
              ) : (
                <>
                  {/* Category & Difficulty */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {previewQuestion.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${DIFFICULTY_BADGE[previewQuestion.difficulty]
                        }`}
                    >
                      {previewQuestion.difficulty}
                    </span>
                    <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] font-mono">
                      {previewQuestion.points} point{previewQuestion.points > 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Title & Statement */}
                  <h2 className="text-base font-bold text-[#0f172a] dark:text-white">
                    {previewQuestion.title}
                  </h2>
                  <p className="text-xs text-[#475569] dark:text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">
                    {previewQuestion.statement}
                  </p>

                  {/* Code snippet if present */}
                  {previewQuestion.codeSnippet && (
                    <div className="p-3.5 rounded-xl bg-[#0b0f17] border border-[#1e293b] font-mono text-xs text-emerald-400 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">{previewQuestion.codeSnippet}</pre>
                    </div>
                  )}

                  {/* Image if present */}
                  {previewQuestion.imageUrl && (
                    <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420] p-2 flex items-center justify-center max-h-56">
                      <img
                        src={previewQuestion.imageUrl}
                        alt="Question diagram"
                        className="max-h-52 object-contain"
                      />
                    </div>
                  )}

                  {/* Options */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-semibold text-[#0f172a] dark:text-white block">
                      Choose the correct answer:
                    </span>
                    {previewQuestion.options.map((opt, idx) => {
                      const letter = String.fromCharCode(65 + idx);
                      const isSelected = previewSelectedOption === opt.id;
                      const isCorrect = opt.isCorrect;

                      let borderClass =
                        "border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0e1420]";
                      if (showExplanation) {
                        if (isCorrect) {
                          borderClass =
                            "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300";
                        } else if (isSelected && !isCorrect) {
                          borderClass =
                            "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300";
                        }
                      } else if (isSelected) {
                        borderClass =
                          "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20";
                      }

                      return (
                        <div
                          key={opt.id}
                          onClick={() => !showExplanation && setPreviewSelectedOption(opt.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${borderClass}`}
                        >
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {letter}
                          </span>

                          <div className="flex-1 text-xs">
                            {opt.type === "code" && opt.code ? (
                              <div className="p-2.5 rounded-lg bg-[#0b0f17] font-mono text-[11px] text-emerald-400 overflow-x-auto">
                                <pre className="whitespace-pre-wrap">{opt.code}</pre>
                              </div>
                            ) : opt.type === "image" && opt.imageUrl ? (
                              <img
                                src={opt.imageUrl}
                                alt={`Option ${letter}`}
                                className="max-h-24 object-contain rounded"
                              />
                            ) : (
                              <span className="font-medium text-[#0f172a] dark:text-white">
                                {opt.text}
                              </span>
                            )}
                          </div>

                          {showExplanation && isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                              Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation Toggle */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 transition-colors"
                    >
                      {showExplanation ? "Hide Solution & Explanation" : "Reveal Answer & Explanation"}
                    </button>

                    {showExplanation && previewQuestion.explanation && (
                      <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
                        <strong className="block mb-1 font-bold text-emerald-700 dark:text-emerald-400">
                          Explanation:
                        </strong>
                        {previewQuestion.explanation}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

