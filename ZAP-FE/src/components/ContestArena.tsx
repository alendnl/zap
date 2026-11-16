"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Timer,
  CheckCircle2,
  AlertCircle,
  Flag,
  ArrowLeft,
  ArrowRight,
  Code2,
  BookOpen,
  Send,
  HelpCircle,
  Sparkles,
  Trophy,
  Award,
  Clock,
  Layers,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  Maximize2,
  AlertTriangle,
  EyeOff,
  Lock,
} from "lucide-react";
import type {
  Contest,
  ContestMCQQuestion,
  ContestCodingQuestion,
  ContestSubmitResponse,
  ContestStartResponse,
  ProctoringTelemetry,
  CodingProblemState,
} from "@/types/contest";
import { contestApi } from "@/services/contestApi";
import { StudentWorkspace } from "./StudentWorkspace";
import type { QuestionData } from "./QuestionPane";
import type { Submission } from "@/services/submissionsApi";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ContestArenaProps {
  contest: Contest;
  mcqQuestions: ContestMCQQuestion[];
  codingQuestions: ContestCodingQuestion[];
  studentId: string;
  studentEmail: string;
  studentName?: string;
  initialSession?: ContestStartResponse;
  onExit: () => void;
}

export function ContestArena({
  contest,
  mcqQuestions,
  codingQuestions,
  studentId,
  studentEmail,
  studentName,
  initialSession,
  onExit,
}: ContestArenaProps) {
  // 1. Initial State Resolution from session or local cache
  const storageKey = `zap.contest.${contest.id}.${studentId}`;

  const loadLocalCache = useCallback(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(storageKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const localCache = useMemo(() => loadLocalCache(), [loadLocalCache]);

  // If already submitted in initialSession, lock to results
  const [submissionResult, setSubmissionResult] = useState<ContestSubmitResponse | null>(() => {
    if (initialSession?.alreadySubmitted && initialSession?.submission) {
      return initialSession.submission;
    }
    return null;
  });

  // Navigation State
  const [activeSection, setActiveSection] = useState<"mcq" | "coding">(
    mcqQuestions.length > 0 ? "mcq" : "coding"
  );
  const [currentMcqIdx, setCurrentMcqIdx] = useState(0);
  const [currentCodingIdx, setCurrentCodingIdx] = useState(0);

  // Candidate Answer State
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>(() => {
    return initialSession?.mcqAnswers || localCache?.mcqAnswers || {};
  });

  const [reviewedQuestionIds, setReviewedQuestionIds] = useState<Set<string>>(() => {
    const list = initialSession?.reviewedQuestionIds || localCache?.reviewedQuestionIds || [];
    return new Set(list);
  });

  // Coding problem state per question
  const [codingState, setCodingState] = useState<Record<string, CodingProblemState>>(() => {
    const initial: Record<string, CodingProblemState> = {};
    for (const q of codingQuestions) {
      initial[q.id] = {
        code: q.starterCode || {},
        lastLanguage: "python",
        status: "UNATTEMPTED",
      };
    }
    const merged = { ...initial, ...(initialSession?.codingState || {}), ...(localCache?.codingState || {}) };
    return merged;
  });

  const [codingSubmissions, setCodingSubmissions] = useState<Record<string, string>>(() => {
    const subs: Record<string, string> = {};
    for (const [qid, state] of Object.entries(codingState)) {
      if (state.lastSubmissionId) {
        subs[qid] = state.lastSubmissionId;
      }
    }
    return subs;
  });

  // Proctoring Telemetry State
  const [proctoring, setProctoring] = useState<ProctoringTelemetry>(() => {
    return (
      initialSession?.proctoring ||
      localCache?.proctoring || {
        tabSwitchCount: 0,
        copyPasteAttempts: 0,
        fullscreenExitCount: 0,
        violationsLog: [],
      }
    );
  });

  // Fullscreen state: show ground rules prompt first before entering fullscreen
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [warningToast, setWarningToast] = useState<{ message: string; type: "WARN" | "BLOCKED" } | null>(null);

  // Timer State (in seconds)
  const totalSeconds = (contest.durationMinutes || 90) * 60;
  const initialTimeSpent = initialSession?.timeSpentSeconds || localCache?.timeSpentSeconds || 0;
  const [timeSpent, setTimeSpent] = useState(initialTimeSpent);
  const [secondsRemaining, setSecondsRemaining] = useState(() => Math.max(0, totalSeconds - initialTimeSpent));

  // Modals & UI filters
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "CORRECT" | "INCORRECT">("ALL");

  // Debounced Sync helper to MongoDB
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerLiveSync = useCallback(
    (
      newMcqAnswers?: Record<string, string>,
      newReviewed?: Set<string>,
      newCodingState?: Record<string, CodingProblemState>,
      newProctoring?: ProctoringTelemetry,
      currentTimeSpent?: number
    ) => {
      const answersToSave = newMcqAnswers ?? mcqAnswers;
      const reviewedToSave = Array.from(newReviewed ?? reviewedQuestionIds);
      const codingToSave = newCodingState ?? codingState;
      const proctoringToSave = newProctoring ?? proctoring;
      const timeToSave = currentTimeSpent ?? timeSpent;

      // 1. Immediately cache in localStorage for disaster recovery
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              mcqAnswers: answersToSave,
              reviewedQuestionIds: reviewedToSave,
              codingState: codingToSave,
              proctoring: proctoringToSave,
              timeSpentSeconds: timeToSave,
            })
          );
        } catch {}
      }

      // 2. Debounce sync to MongoDB
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await contestApi.sync(contest.id || contest.slug, {
            studentId,
            studentEmail,
            studentName,
            mcqAnswers: answersToSave,
            reviewedQuestionIds: reviewedToSave,
            codingState: codingToSave,
            proctoring: proctoringToSave,
            timeSpentSeconds: timeToSave,
          });
        } catch (err) {
          console.warn("Real-time contest sync error:", err);
        }
      }, 800);
    },
    [contest.id, contest.slug, studentId, studentEmail, studentName, mcqAnswers, reviewedQuestionIds, codingState, proctoring, timeSpent, storageKey]
  );

  // Background Heartbeat Sync (every 15s)
  useEffect(() => {
    if (submissionResult || !hasEnteredFullscreen) return;
    const heartbeat = setInterval(() => {
      triggerLiveSync();
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [submissionResult, hasEnteredFullscreen, triggerLiveSync]);

  // Timer countdown hook
  useEffect(() => {
    if (submissionResult || !hasEnteredFullscreen) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
      setTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [submissionResult, hasEnteredFullscreen]);

  // Fullscreen Ground Rule & Fullscreen Exit Listener
  useEffect(() => {
    if (submissionResult || !hasEnteredFullscreen) return;

    const handleFullscreenChange = () => {
      const full = !!document.fullscreenElement;
      setIsFullscreen(full);
      if (!full) {
        // Candidate exited fullscreen! Lock content & increment violation
        setProctoring((prev) => {
          const next = {
            ...prev,
            fullscreenExitCount: prev.fullscreenExitCount + 1,
            violationsLog: [
              ...prev.violationsLog,
              {
                type: "FULLSCREEN_EXIT",
                timestamp: new Date().toISOString(),
                details: "Candidate exited fullscreen mode",
              },
            ],
          };
          triggerLiveSync(undefined, undefined, undefined, next);
          return next;
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [submissionResult, hasEnteredFullscreen, triggerLiveSync]);

  // Request Fullscreen on Start
  const handleStartWithFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request error:", err);
    }
    setHasEnteredFullscreen(true);
    setIsFullscreen(true);
  };

  // Re-enter Fullscreen on Lock Screen
  const handleResumeFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err) {
      console.warn("Failed to enter fullscreen:", err);
    }
  };

  // Copy-Paste Prevention Listener (Blocks copy, cut, paste, context menu)
  useEffect(() => {
    if (submissionResult || !hasEnteredFullscreen) return;

    const handleBlockedClipboard = (e: Event, actionType: string) => {
      e.preventDefault();
      e.stopPropagation();

      setWarningToast({
        message: `Action Blocked: ${actionType} is strictly disabled during the assessment.`,
        type: "BLOCKED",
      });

      setProctoring((prev) => {
        const next = {
          ...prev,
          copyPasteAttempts: prev.copyPasteAttempts + 1,
          violationsLog: [
            ...prev.violationsLog,
            {
              type: "COPY_PASTE",
              timestamp: new Date().toISOString(),
              details: `Attempted ${actionType}`,
            },
          ],
        };
        triggerLiveSync(undefined, undefined, undefined, next);
        return next;
      });

      setTimeout(() => setWarningToast(null), 3500);
    };

    const onCopy = (e: ClipboardEvent) => handleBlockedClipboard(e, "Copy");
    const onCut = (e: ClipboardEvent) => handleBlockedClipboard(e, "Cut");
    const onPaste = (e: ClipboardEvent) => handleBlockedClipboard(e, "Paste");
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCut, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("contextmenu", onContextMenu, true);

    return () => {
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCut, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [submissionResult, hasEnteredFullscreen, triggerLiveSync]);

  // Tab-Switch Prevention & Window Blur Listener
  useEffect(() => {
    if (submissionResult || !hasEnteredFullscreen) return;

    const recordTabSwitch = (reason: string) => {
      setProctoring((prev) => {
        const next = {
          ...prev,
          tabSwitchCount: prev.tabSwitchCount + 1,
          violationsLog: [
            ...prev.violationsLog,
            {
              type: "TAB_SWITCH",
              timestamp: new Date().toISOString(),
              details: reason,
            },
          ],
        };
        triggerLiveSync(undefined, undefined, undefined, next);
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordTabSwitch("Tab hidden or user switched applications");
      } else if (document.visibilityState === "visible") {
        setWarningToast({
          message: "Warning: Switching tabs is not allowed! Violation recorded.",
          type: "WARN",
        });
        setTimeout(() => setWarningToast(null), 4500);
      }
    };

    const handleBlur = () => {
      if (document.visibilityState === "visible") {
        recordTabSwitch("Window lost focus");
        setWarningToast({
          message: "Warning: Assessment window lost focus! Violation recorded.",
          type: "WARN",
        });
        setTimeout(() => setWarningToast(null), 4500);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [submissionResult, hasEnteredFullscreen, triggerLiveSync]);

  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // MCQ Handlers
  const handleSelectOption = (questionId: string, optionId: string) => {
    const nextAnswers = { ...mcqAnswers, [questionId]: optionId };
    setMcqAnswers(nextAnswers);
    triggerLiveSync(nextAnswers);
  };

  const handleClearOption = (questionId: string) => {
    const nextAnswers = { ...mcqAnswers };
    delete nextAnswers[questionId];
    setMcqAnswers(nextAnswers);
    triggerLiveSync(nextAnswers);
  };

  const handleToggleReview = (questionId: string) => {
    const nextReviewed = new Set(reviewedQuestionIds);
    if (nextReviewed.has(questionId)) {
      nextReviewed.delete(questionId);
    } else {
      nextReviewed.add(questionId);
    }
    setReviewedQuestionIds(nextReviewed);
    triggerLiveSync(undefined, nextReviewed);
  };

  // Coding Handlers
  const handleCodingCodeChange = useCallback(
    (lang: string, newCode: string) => {
      const currentQ = codingQuestions[currentCodingIdx];
      if (!currentQ) return;

      setCodingState((prev) => {
        const existing = prev[currentQ.id] || {
          code: {},
          lastLanguage: lang,
          status: "UNATTEMPTED",
        };
        const next: Record<string, CodingProblemState> = {
          ...prev,
          [currentQ.id]: {
            ...existing,
            lastLanguage: lang,
            code: {
              ...existing.code,
              [lang]: newCode,
            },
            status: existing.status === "UNATTEMPTED" ? "ATTEMPTED" : existing.status,
          },
        };
        triggerLiveSync(undefined, undefined, next);
        return next;
      });
    },
    [codingQuestions, currentCodingIdx, triggerLiveSync]
  );

  const handleCodingSubmissionComplete = useCallback(
    (sub: Submission) => {
      const currentQ = codingQuestions[currentCodingIdx];
      if (!currentQ || !sub.id) return;

      setCodingSubmissions((prev) => ({
        ...prev,
        [currentQ.id]: sub.id,
      }));

      setCodingState((prev) => {
        const existing = prev[currentQ.id] || {
          code: {},
          lastLanguage: sub.language,
          status: "ATTEMPTED",
        };
        const isAccepted = sub.verdict === "ACCEPTED";
        const next: Record<string, CodingProblemState> = {
          ...prev,
          [currentQ.id]: {
            ...existing,
            lastSubmissionId: sub.id,
            bestVerdict: sub.verdict,
            status: isAccepted ? "ACCEPTED" : "SUBMITTED",
          },
        };
        triggerLiveSync(undefined, undefined, next);
        return next;
      });
    },
    [codingQuestions, currentCodingIdx, triggerLiveSync]
  );

  // Submit Contest (Final Lock)
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await contestApi.submit(contest.id || contest.slug, {
        studentId,
        studentEmail,
        studentName,
        mcqAnswers,
        codingSubmissions,
        codingState,
        proctoring,
        timeSpentSeconds: timeSpent,
      });

      // Clear local working cache since submitted
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }

      setSubmissionResult(res);
      setSubmitModalOpen(false);

      // Exit fullscreen mode upon completion
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      alert(err.message || "Failed to submit contest. Please check your internet connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = useCallback(() => {
    void handleConfirmSubmit();
  }, [contest.id, contest.slug, studentId, studentEmail, studentName, mcqAnswers, codingSubmissions, codingState, proctoring, timeSpent]);

  // Coding Progress Metrics
  const codingAcceptedCount = useMemo(() => {
    return Object.values(codingState).filter((s) => s.status === "ACCEPTED").length;
  }, [codingState]);

  const codingSubmittedCount = useMemo(() => {
    return Object.values(codingState).filter((s) => s.status === "ACCEPTED" || s.status === "SUBMITTED").length;
  }, [codingState]);

  const codingAttemptedCount = useMemo(() => {
    return Object.values(codingState).filter((s) => s.status !== "UNATTEMPTED").length;
  }, [codingState]);

  // Active question getters
  const currentMcq = mcqQuestions[currentMcqIdx];
  const currentCoding = codingQuestions[currentCodingIdx];

  const currentCodingAsQuestionData = useMemo<QuestionData | null>(() => {
    if (!currentCoding) return null;
    return {
      id: currentCoding.id,
      slug: currentCoding.slug,
      title: currentCoding.title,
      difficulty: (currentCoding.difficulty?.toUpperCase() as any) || "MEDIUM",
      tags: currentCoding.tags || [],
      statement: currentCoding.statement,
      examples: currentCoding.examples || [],
      constraints: currentCoding.constraints || [],
      starterCode: currentCoding.starterCode,
    };
  }, [currentCoding]);

  // Calculated Stats
  const mcqAnsweredCount = Object.keys(mcqAnswers).length;
  const mcqReviewCount = reviewedQuestionIds.size;

  // ---------------------------------------------------------------------------------
  // VIEW 1: Post-Submission Scorecard & Review (Single Attempt Result)
  // ---------------------------------------------------------------------------------
  if (submissionResult) {
    const filteredReview = submissionResult.mcqBreakdown.filter((item) => {
      if (reviewFilter === "CORRECT") return item.isCorrect;
      if (reviewFilter === "INCORRECT") return !item.isCorrect;
      return true;
    });

    const resultProctoring = submissionResult.proctoring || proctoring;
    const totalInfractions =
      resultProctoring.tabSwitchCount +
      resultProctoring.copyPasteAttempts +
      resultProctoring.fullscreenExitCount;

    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col font-sans">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              Z
            </span>
            <span className="font-bold text-sm tracking-tight text-[#0f172a] dark:text-white">
              Assessment Results: {contest.title}
            </span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Contests</span>
          </button>
        </header>

        {/* Results Canvas */}
        <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full space-y-8">
          {/* Hero Celebration Scorecard */}
          <div className="bg-gradient-to-br from-white to-blue-50/50 dark:from-[#121824] dark:to-[#1a2233] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assessment Completed & Locked (Single Attempt)</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
                  {contest.title}
                </h1>
                <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8]">
                  Candidate: <strong className="text-[#0f172a] dark:text-white">{studentName || studentEmail}</strong> · Submitted at {new Date(submissionResult.submittedAt).toLocaleTimeString()}
                </p>
              </div>

              {/* Total Score Badge */}
              <div className="flex flex-col items-center sm:items-end bg-white dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-xl shadow-xs min-w-[160px]">
                <span className="text-xs uppercase font-mono text-[#64748b] dark:text-[#94a3b8] font-semibold">
                  Total Score
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
                    {submissionResult.totalScore}
                  </span>
                  <span className="text-sm font-mono text-[#64748b] dark:text-[#94a3b8]">
                    / {submissionResult.maxTotalScore}
                  </span>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {submissionResult.percentage}% Score
                </span>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
              <div className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">MCQ Correct</span>
                <div className="text-xl font-bold font-mono text-[#0f172a] dark:text-white mt-1">
                  {submissionResult.mcqCorrectCount} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {submissionResult.mcqTotalCount}</span>
                </div>
              </div>
              <div className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">MCQ Points</span>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {submissionResult.mcqScore} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {submissionResult.maxMcqScore}</span>
                </div>
              </div>
              <div className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Coding Attempted</span>
                <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  {submissionResult.codingProblemsAttempted} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {submissionResult.codingTotalCount}</span>
                </div>
              </div>
              <div className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Time Taken</span>
                <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                  {formatTimer(submissionResult.timeSpentSeconds)}
                </div>
              </div>
            </div>
          </div>

          {/* Proctoring & Integrity Telemetry Card */}
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-base text-[#0f172a] dark:text-white">
                  Proctoring & Assessment Integrity Summary
                </h3>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  totalInfractions === 0
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                {totalInfractions === 0 ? "Clean Integrity Record" : `${totalInfractions} Infraction Events`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Tab Switch Events</span>
                  <EyeOff className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0f172a] dark:text-white mt-1">
                  {resultProctoring.tabSwitchCount}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Copy/Paste Interceptions</span>
                  <AlertTriangle className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0f172a] dark:text-white mt-1">
                  {resultProctoring.copyPasteAttempts}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Fullscreen Exits</span>
                  <Lock className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0f172a] dark:text-white mt-1">
                  {resultProctoring.fullscreenExitCount}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: MCQ Detailed Review */}
          {submissionResult.mcqBreakdown.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <h2 className="text-lg font-bold text-[#0f172a] dark:text-white">
                  Section 1: MCQ Solution Breakdown
                </h2>
                <div className="flex items-center gap-1.5 text-xs bg-[#f1f5f9] dark:bg-[#161e2e] p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReviewFilter("ALL")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      reviewFilter === "ALL"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                  >
                    All ({submissionResult.mcqBreakdown.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter("CORRECT")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      reviewFilter === "CORRECT"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                  >
                    Correct ({submissionResult.mcqCorrectCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewFilter("INCORRECT")}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      reviewFilter === "INCORRECT"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                  >
                    Incorrect ({submissionResult.mcqBreakdown.length - submissionResult.mcqCorrectCount})
                  </button>
                </div>
              </div>

              {/* MCQ Cards List */}
              <div className="space-y-4">
                {filteredReview.map((item, idx) => (
                  <div
                    key={item.questionId}
                    className={`bg-white dark:bg-[#121824] border rounded-2xl p-5 shadow-xs transition-colors ${
                      item.isCorrect
                        ? "border-emerald-500/20 dark:border-emerald-500/25"
                        : "border-rose-500/20 dark:border-rose-500/25"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            item.isCorrect
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {item.isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        </span>
                        <span className="font-bold text-sm text-[#0f172a] dark:text-white">
                          Question {idx + 1}: {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8]">
                          {item.category}
                        </span>
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                            item.isCorrect
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          {item.pointsAwarded} pts
                        </span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-[#334155] dark:text-[#cbd5e1] mb-4 whitespace-pre-wrap leading-relaxed">
                      {item.statement}
                    </p>

                    {/* Options Breakdown */}
                    <div className="grid grid-cols-1 gap-2 mb-4">
                      {item.options.map((opt) => {
                        const isUserPick = opt.id === item.selectedOptionId;
                        const isCorrectOption = opt.isCorrect || opt.id === item.correctOptionId;

                        let style =
                          "border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-[#475569] dark:text-[#94a3b8]";
                        if (isCorrectOption) {
                          style =
                            "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold";
                        } else if (isUserPick && !item.isCorrect) {
                          style =
                            "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-300 line-through";
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${style}`}
                          >
                            <span className="flex-1">{opt.text || opt.code || "Option"}</span>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold">
                              {isCorrectOption && (
                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white">
                                  Correct Answer
                                </span>
                              )}
                              {isUserPick && (
                                <span
                                  className={`px-2 py-0.5 rounded text-white ${
                                    item.isCorrect ? "bg-emerald-600" : "bg-rose-600"
                                  }`}
                                >
                                  Your Choice
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation Callout */}
                    {item.explanation && (
                      <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200">
                        <strong className="block font-semibold mb-1 text-blue-800 dark:text-blue-300">
                          Explanation:
                        </strong>
                        <p className="leading-relaxed">{item.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Coding Challenges Review */}
          {submissionResult.codingBreakdown.length > 0 && (
            <div className="space-y-4 pt-4">
              <h2 className="text-lg font-bold text-[#0f172a] dark:text-white pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                Section 2: Coding Challenges Review
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {submissionResult.codingBreakdown.map((codeItem) => (
                  <div
                    key={codeItem.questionId}
                    className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-4 rounded-xl shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-xs text-[#0f172a] dark:text-white truncate">
                        {codeItem.title}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                        {codeItem.difficulty}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8] mt-3 pt-3 border-t border-[#e2e8f0] dark:border-[#1e293b]">
                      <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {codeItem.status}
                      </span>
                      <span className="font-mono font-bold text-[#0f172a] dark:text-white">
                        {codeItem.score} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------------
  // VIEW 2: Pre-Assessment Ground Rules Onboarding Modal
  // ---------------------------------------------------------------------------------
  if (!hasEnteredFullscreen) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-4 transition-colors">
        <div className="max-w-xl w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-[#0f172a] dark:text-white animate-in fade-in-50 zoom-in-95 relative">
          <div className="absolute top-6 right-6">
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Assessment Integrity & Ground Rules</h2>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">{contest.title} · {contest.durationMinutes} Minutes</p>
            </div>
          </div>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex gap-3">
              <Maximize2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#0f172a] dark:text-white mb-0.5">Mandatory Fullscreen Mode</strong>
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                  Assessment runs strictly in fullscreen. If you exit fullscreen at any time, test content will be completely locked until you return.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#0f172a] dark:text-white mb-0.5">Copy & Paste Strictly Disabled</strong>
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                  All copy, cut, paste, and context-menu actions are disabled. Every copy/paste attempt is logged as an infraction.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex gap-3">
              <EyeOff className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#0f172a] dark:text-white mb-0.5">Tab Switching Prohibited</strong>
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                  Switching tabs or minimizing the browser window is monitored in real-time. Violations are saved to your contest submission.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] flex gap-3">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[#0f172a] dark:text-white mb-0.5">Single-Attempt Policy</strong>
                <p className="text-[#64748b] dark:text-[#94a3b8]">
                  You have exactly one attempt. Your answers and code auto-save in real-time. Once final submission is confirmed, the contest is completed and cannot be retaken.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white cursor-pointer transition-colors"
            >
              Cancel & Return
            </button>
            <button
              type="button"
              onClick={handleStartWithFullscreen}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 cursor-pointer transition-all"
            >
              <Maximize2 className="w-4 h-4" />
              <span>I Understand & Enter Fullscreen Assessment</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------------
  // VIEW 3: Active Fullscreen Assessment Arena (with Fullscreen Lock overlay)
  // ---------------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col font-sans select-none">
      {/* 1. Fullscreen Exit Lock Overlay (Content Hidden until candidate re-enters fullscreen) */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 dark:bg-[#0b0f17]/90 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 text-rose-500 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#0f172a] dark:text-white">Assessment Content Locked</h3>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                You exited fullscreen mode. In accordance with test integrity guidelines, all questions and code editors remain hidden until fullscreen is restored.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 font-mono">
              Fullscreen Exits Recorded: {proctoring.fullscreenExitCount}
            </div>
            <button
              type="button"
              onClick={handleResumeFullscreen}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Return to Fullscreen Assessment</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Warning Toast Notification */}
      {warningToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-top-4">
          <div
            className={`p-3.5 rounded-2xl shadow-xl border flex items-center gap-3 text-xs ${
              warningToast.type === "BLOCKED"
                ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
                : "bg-amber-950/90 border-amber-500/50 text-amber-200"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
            <span className="flex-1 font-semibold">{warningToast.message}</span>
            <button type="button" onClick={() => setWarningToast(null)} className="text-white/70 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Top Header Toolbar */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 sm:px-6 h-14 flex items-center justify-between gap-3 shadow-xs">
        {/* Brand & Contest Title */}
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
            Z
          </span>
          <div className="flex flex-col">
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-[#0f172a] dark:text-white truncate max-w-[180px] sm:max-w-md">
              {contest.title}
            </span>
            <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
              {mcqQuestions.length} MCQs · {codingQuestions.length} Coding · {contest.totalPoints} Pts
            </span>
          </div>
        </div>

        {/* Section Tabs Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
          {mcqQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveSection("mcq")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSection === "mcq"
                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Section 1: MCQs ({mcqQuestions.length})</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {mcqAnsweredCount}/{mcqQuestions.length}
              </span>
            </button>
          )}

          {codingQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveSection("coding")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeSection === "coding"
                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>Section 2: Coding ({codingQuestions.length})</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                {codingAcceptedCount}/{codingQuestions.length}
              </span>
            </button>
          )}
        </div>

        {/* Right Tools: Telemetry Badges, Countdown Timer & Final Submit Button */}
        <div className="flex items-center gap-2">
          {/* Proctoring telemetry chips */}
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-mono">
            {proctoring.tabSwitchCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                Tabs: {proctoring.tabSwitchCount}
              </span>
            )}
            {proctoring.copyPasteAttempts > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold">
                Copy: {proctoring.copyPasteAttempts}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>Proctored</span>
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs font-semibold shadow-xs ${
              secondsRemaining < 600
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse"
                : "bg-white dark:bg-[#121824] text-[#0f172a] dark:text-[#f8fafc] border-[#e2e8f0] dark:border-[#1e293b]"
            }`}
            title="Time Remaining"
          >
            <Clock className="w-3.5 h-3.5 text-[#64748b] dark:text-[#94a3b8]" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>

          <ThemeToggle />

          <button
            type="button"
            onClick={() => setSubmitModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Submit Contest</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      {/* 3. SECTION 1: MCQ WORKSPACE */}
      {activeSection === "mcq" && (
        <div className="flex-1 flex flex-col">
          {/* Top Question Numbers Palette Bar (Q1..Q25) */}
          <div className="border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 sm:px-6 py-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0f172a] dark:text-white uppercase font-mono">
                  MCQ Questions ({mcqQuestions.length})
                </span>
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                  Click any number to jump directly
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Answered ({mcqAnsweredCount})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span>Review ({mcqReviewCount})</span>
                </div>
              </div>
            </div>

            {/* Horizontal Palette Scroll */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-thin">
              {mcqQuestions.map((q, idx) => {
                const isCurrent = currentMcqIdx === idx;
                const isAnswered = q.id in mcqAnswers;
                const isReviewed = reviewedQuestionIds.has(q.id);

                let badgeStyle =
                  "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#232f45] hover:border-blue-400";
                if (isCurrent) {
                  badgeStyle = "bg-blue-600 text-white border-blue-600 font-bold shadow-xs scale-105";
                } else if (isReviewed) {
                  badgeStyle =
                    "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/40 font-semibold";
                } else if (isAnswered) {
                  badgeStyle =
                    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-semibold";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentMcqIdx(idx)}
                    className={`min-w-[42px] h-8 rounded-lg text-xs font-mono border flex items-center justify-center transition-all cursor-pointer relative shrink-0 ${badgeStyle}`}
                  >
                    <span>Q{idx + 1}</span>
                    {isReviewed && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Content Area */}
          {currentMcq ? (
            <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-6 w-full flex flex-col justify-between">
              <div className="space-y-6">
                {/* Question Header & Meta */}
                <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono text-xs font-bold shadow-xs">
                      Question {currentMcqIdx + 1}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#232f45]">
                      {currentMcq.category}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                      {currentMcq.difficulty}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleReview(currentMcq.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        reviewedQuestionIds.has(currentMcq.id)
                          ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                          : "bg-white dark:bg-[#121824] text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#1e293b] hover:text-purple-600"
                      }`}
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{reviewedQuestionIds.has(currentMcq.id) ? "Marked for Review" : "Mark Review"}</span>
                    </button>
                  </div>
                </div>

                {/* Question Statement */}
                <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 shadow-xs space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#0f172a] dark:text-white leading-snug">
                    {currentMcq.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#334155] dark:text-[#cbd5e1] whitespace-pre-wrap leading-relaxed">
                    {currentMcq.statement}
                  </p>

                  {/* Optional Code Snippet inside Question Statement */}
                  {currentMcq.codeSnippet && (
                    <div className="rounded-xl overflow-hidden border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] p-4">
                      <div className="text-[10px] uppercase font-mono text-[#64748b] dark:text-[#94a3b8] mb-1 font-semibold">
                        Code Snippet ({currentMcq.codeLanguage || "code"}):
                      </div>
                      <pre className="text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] overflow-x-auto leading-relaxed">
                        {currentMcq.codeSnippet}
                      </pre>
                    </div>
                  )}
                </div>

                {/* MCQ Options Cards */}
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider font-mono text-[#64748b] dark:text-[#94a3b8]">
                    Select One Option:
                  </span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {currentMcq.options.map((option, optIdx) => {
                      const isSelected = mcqAnswers[currentMcq.id] === option.id;
                      const letter = String.fromCharCode(65 + optIdx);

                      return (
                        <div
                          key={option.id}
                          onClick={() => handleSelectOption(currentMcq.id, option.id)}
                          className={`p-4 rounded-xl border text-xs sm:text-sm flex items-start gap-3.5 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-600 dark:border-blue-500 ring-2 ring-blue-600/20 shadow-xs"
                              : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] hover:border-blue-400 hover:bg-[#f8fafc] dark:hover:bg-[#1a2233]"
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white"
                                : "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8]"
                            }`}
                          >
                            {letter}
                          </div>
                          <div className="flex-1 pt-0.5">
                            {option.text && <p className="leading-relaxed">{option.text}</p>}
                            {option.code && (
                              <pre className="font-mono text-xs bg-[#f1f5f9] dark:bg-[#0b0f17] p-2.5 rounded-lg overflow-x-auto mt-1 border border-[#e2e8f0] dark:border-[#1e293b]">
                                {option.code}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Option Clear Button */}
                {mcqAnswers[currentMcq.id] && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleClearOption(currentMcq.id)}
                      className="text-xs text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 underline cursor-pointer"
                    >
                      Clear my choice
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Pagination Controls */}
              <div className="flex items-center justify-between pt-8 pb-4 border-t border-[#e2e8f0] dark:border-[#1e293b] mt-8">
                <button
                  type="button"
                  disabled={currentMcqIdx === 0}
                  onClick={() => setCurrentMcqIdx((prev) => Math.max(0, prev - 1))}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
                  Question {currentMcqIdx + 1} of {mcqQuestions.length}
                </span>

                {currentMcqIdx < mcqQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentMcqIdx((prev) => prev + 1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  codingQuestions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveSection("coding")}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <span>Proceed to Coding</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </main>
          ) : (
            <div className="py-24 text-center text-[#64748b] dark:text-[#94a3b8] text-xs">
              No MCQ questions found in this contest.
            </div>
          )}
        </div>
      )}

      {/* 4. SECTION 2: CODING WORKSPACE */}
      {activeSection === "coding" && (
        <div className="flex-1 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
          {/* Coding Problem Selector Tabs with Titles & Progress Bar */}
          <div className="border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 py-2 shadow-2xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              {/* Problem Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase font-mono mr-1 shrink-0">
                  Problems:
                </span>
                {codingQuestions.map((q, idx) => {
                  const isCurrent = currentCodingIdx === idx;
                  const probState = codingState[q.id];
                  const probStatus = probState?.status || "UNATTEMPTED";

                  let statusBadge = (
                    <span className="w-2 h-2 rounded-full bg-slate-400" title="Not attempted" />
                  );
                  if (probStatus === "ACCEPTED") {
                    statusBadge = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
                  } else if (probStatus === "SUBMITTED") {
                    statusBadge = <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
                  } else if (probStatus === "ATTEMPTED") {
                    statusBadge = <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="In progress" />;
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentCodingIdx(idx)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-xs"
                          : "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#232f45] hover:border-blue-400"
                      }`}
                    >
                      <span className="font-mono text-[11px]">Q{idx + 1}:</span>
                      <span className="truncate max-w-[140px]">{q.title}</span>
                      <span
                        className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded font-bold ${
                          isCurrent
                            ? "bg-white/20 text-white"
                            : "bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      {statusBadge}
                    </button>
                  );
                })}
              </div>

              {/* Coding Progress Bar & Status */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="text-[#64748b] dark:text-[#94a3b8]">Progress:</span>
                  <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {codingAcceptedCount}/{codingQuestions.length} Solved
                  </span>
                  <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    ({codingAttemptedCount} attempted)
                  </span>
                </div>
                <div className="w-24 sm:w-36 h-2 rounded-full bg-[#e2e8f0] dark:bg-[#1e293b] overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${(codingAcceptedCount / Math.max(1, codingQuestions.length)) * 100}%` }}
                  />
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{
                      width: `${((codingSubmittedCount - codingAcceptedCount) / Math.max(1, codingQuestions.length)) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-amber-500 h-full transition-all duration-300"
                    style={{
                      width: `${((codingAttemptedCount - codingSubmittedCount) / Math.max(1, codingQuestions.length)) * 100}%`,
                    }}
                  />
                </div>
                {mcqQuestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSection("mcq")}
                    className="hidden sm:flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer shrink-0 ml-2"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>MCQs ({mcqAnsweredCount}/{mcqQuestions.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Embedded Full Compiler Template with Isolated Submissions & State Persistence */}
          <div className="flex-1 overflow-hidden">
            {currentCodingAsQuestionData ? (
              <StudentWorkspace
                key={currentCodingAsQuestionData.id}
                question={currentCodingAsQuestionData}
                contestId={contest.id}
                initialCodes={codingState[currentCodingAsQuestionData.id]?.code}
                initialLanguage={codingState[currentCodingAsQuestionData.id]?.lastLanguage || "python"}
                onCodeChange={handleCodingCodeChange}
                onSubmissionComplete={handleCodingSubmissionComplete}
                preventCopyPaste={true}
                onBackToCatalog={() => setActiveSection("mcq")}
              />
            ) : (
              <div className="py-24 text-center text-[#64748b] dark:text-[#94a3b8] text-xs">
                No coding questions found in this contest.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Final Submission Confirmation Modal */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white">
                  Confirm Contest Submission
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Counters */}
            <div className="space-y-3">
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                Review your completion status below before final submission. In accordance with single-attempt rules, once submitted your responses are locked and evaluated.
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                  <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                    MCQs Answered
                  </span>
                  <div className="text-lg font-bold font-mono text-[#0f172a] dark:text-white mt-0.5">
                    {mcqAnsweredCount} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {mcqQuestions.length}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                  <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                    Marked for Review
                  </span>
                  <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    {mcqReviewCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                  <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                    Coding Solved
                  </span>
                  <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {codingAcceptedCount} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {codingQuestions.length}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b]">
                  <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8] uppercase font-mono">
                    Time Remaining
                  </span>
                  <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    {formatTimer(secondsRemaining)}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSubmitModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
              >
                Keep Working
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "Submitting..." : "Confirm Final Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
