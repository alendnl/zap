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
} from "lucide-react";
import type {
  Contest,
  ContestMCQQuestion,
  ContestCodingQuestion,
  ContestSubmitResponse,
} from "@/types/contest";
import { contestApi } from "@/services/contestApi";
import { StudentWorkspace } from "./StudentWorkspace";
import type { QuestionData } from "./QuestionPane";

interface ContestArenaProps {
  contest: Contest;
  mcqQuestions: ContestMCQQuestion[];
  codingQuestions: ContestCodingQuestion[];
  studentId: string;
  studentEmail: string;
  studentName?: string;
  onExit: () => void;
}

export function ContestArena({
  contest,
  mcqQuestions,
  codingQuestions,
  studentId,
  studentEmail,
  studentName,
  onExit,
}: ContestArenaProps) {
  // Navigation State
  const [activeSection, setActiveSection] = useState<"mcq" | "coding">(
    mcqQuestions.length > 0 ? "mcq" : "coding"
  );
  const [currentMcqIdx, setCurrentMcqIdx] = useState(0);
  const [currentCodingIdx, setCurrentCodingIdx] = useState(0);

  // Candidate Answer State
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [reviewedQuestionIds, setReviewedQuestionIds] = useState<Set<string>>(new Set());
  const [codingSubmissions, setCodingSubmissions] = useState<Record<string, string>>({});

  // Timer State (in seconds)
  const totalSeconds = (contest.durationMinutes || 90) * 60;
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const [timeSpent, setTimeSpent] = useState(0);

  // Submission & Results State
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<ContestSubmitResponse | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"ALL" | "CORRECT" | "INCORRECT">("ALL");

  // Timer countdown hook
  useEffect(() => {
    if (submissionResult) return;
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
  }, [submissionResult]);

  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Select option for current MCQ
  const handleSelectOption = (questionId: string, optionId: string) => {
    setMcqAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  // Clear answer
  const handleClearOption = (questionId: string) => {
    setMcqAnswers((prev) => {
      const copy = { ...prev };
      delete copy[questionId];
      return copy;
    });
  };

  // Toggle review flag
  const handleToggleReview = (questionId: string) => {
    setReviewedQuestionIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(questionId)) {
        copy.delete(questionId);
      } else {
        copy.add(questionId);
      }
      return copy;
    });
  };

  // Submit Contest
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    try {
      const res = await contestApi.submit(contest.id || contest.slug, {
        studentId,
        studentEmail,
        studentName,
        mcqAnswers,
        codingSubmissions,
        timeSpentSeconds: timeSpent,
      });
      setSubmissionResult(res);
      setSubmitModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to submit contest. Please check your internet connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = useCallback(() => {
    void handleConfirmSubmit();
  }, [contest.id, contest.slug, studentId, studentEmail, studentName, mcqAnswers, codingSubmissions, timeSpent]);

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
  const codingAttemptedCount = Object.keys(codingSubmissions).length;

  // Render Post-Submission Scorecard & Review
  if (submissionResult) {
    const filteredReview = submissionResult.mcqBreakdown.filter((item) => {
      if (reviewFilter === "CORRECT") return item.isCorrect;
      if (reviewFilter === "INCORRECT") return !item.isCorrect;
      return true;
    });

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
                  <span>Submission Recorded Successfully</span>
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
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">MCQ Score</span>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                  {submissionResult.mcqScore} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {submissionResult.maxMcqScore} pts</span>
                </div>
              </div>

              <div className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Coding Challenges</span>
                <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  {submissionResult.codingProblemsAttempted} <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">/ {submissionResult.codingTotalCount}</span>
                </div>
              </div>

              <div className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl">
                <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] font-medium">Time Taken</span>
                <div className="text-xl font-bold font-mono text-[#0f172a] dark:text-white mt-1">
                  {Math.floor(submissionResult.timeSpentSeconds / 60)}m {submissionResult.timeSpentSeconds % 60}s
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Detailed MCQ Solution Review */}
          {submissionResult.mcqBreakdown.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div>
                  <h2 className="text-lg font-bold text-[#0f172a] dark:text-white">
                    Section 1: MCQ Solution Breakdown & Explanations
                  </h2>
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    Review the official answers, explanation steps, and your performance for every question.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-white dark:bg-[#121824] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs">
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
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">
                        {codeItem.difficulty}
                      </span>
                      <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {codeItem.score} pts
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#0f172a] dark:text-white truncate">
                      {codeItem.title}
                    </h3>
                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                      Status: <strong className="text-emerald-600 dark:text-emerald-400">{codeItem.status}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col font-sans select-none">
      {/* 1. Global Contest Sticky Header Bar */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] shadow-xs px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand & Contest Title */}
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
            Z
          </span>
          <div className="flex flex-col">
            <span className="font-extrabold text-xs sm:text-sm tracking-tight text-[#0f172a] dark:text-white truncate max-w-[200px] sm:max-w-md">
              {contest.title}
            </span>
            <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
              {mcqQuestions.length} MCQs · {codingQuestions.length} Coding Problems · {contest.totalPoints} Points
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
                {codingAttemptedCount}/{codingQuestions.length}
              </span>
            </button>
          )}
        </div>

        {/* Right Tools: Countdown Timer & Final Submit Button */}
        <div className="flex items-center gap-2.5">
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

      {/* 2. SECTION 1: MCQ WORKSPACE */}
      {activeSection === "mcq" && (
        <div className="flex-1 flex flex-col">
          {/* Top Question Palette: Q1, Q2, Q3, ... Q25 */}
          <div className="border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 py-2.5 shadow-2xs">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase font-mono mr-1 shrink-0">
                  Questions:
                </span>
                {mcqQuestions.map((q, idx) => {
                  const isAnswered = q.id in mcqAnswers;
                  const isReviewed = reviewedQuestionIds.has(q.id);
                  const isCurrent = currentMcqIdx === idx;

                  let style =
                    "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#232f45] hover:border-blue-400";
                  if (isCurrent) {
                    style =
                      "bg-blue-600 text-white font-bold ring-2 ring-blue-500/50 border-blue-600 shadow-xs";
                  } else if (isReviewed) {
                    style =
                      "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 font-semibold";
                  } else if (isAnswered) {
                    style =
                      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-semibold";
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentMcqIdx(idx)}
                      className={`relative px-2.5 py-1.5 rounded-lg border text-xs font-mono shrink-0 transition-all cursor-pointer ${style}`}
                      title={`Question ${idx + 1}`}
                    >
                      <span>Q{idx + 1}</span>
                      {isReviewed && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white dark:ring-[#121824]" />
                      )}
                      {!isReviewed && isAnswered && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121824]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress Summary Pill */}
              <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] shrink-0">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{mcqAnsweredCount} Answered</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span>{mcqReviewCount} Marked</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>{mcqQuestions.length - mcqAnsweredCount} Left</span>
                </span>
              </div>
            </div>
          </div>

          {/* Current Question View */}
          {currentMcq ? (
            <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full flex flex-col justify-between">
              <div className="space-y-6">
                {/* Question Metadata Header */}
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold font-mono">
                      Question {currentMcqIdx + 1} of {mcqQuestions.length}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] text-xs font-semibold">
                      {currentMcq.category}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-[#f1f5f9] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] text-xs font-semibold">
                      {currentMcq.difficulty}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleReview(currentMcq.id)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      reviewedQuestionIds.has(currentMcq.id)
                        ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                        : "text-[#64748b] dark:text-[#94a3b8] border-[#e2e8f0] dark:border-[#1e293b] hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{reviewedQuestionIds.has(currentMcq.id) ? "Marked for Review" : "Mark for Review"}</span>
                  </button>
                </div>

                {/* Question Statement */}
                <div className="space-y-4">
                  <h2 className="text-base sm:text-lg font-bold text-[#0f172a] dark:text-white leading-relaxed whitespace-pre-wrap">
                    {currentMcq.statement}
                  </h2>

                  {/* Code Snippet if present */}
                  {currentMcq.codeSnippet && (
                    <div className="rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#0e1420] p-4 font-mono text-xs text-blue-100 overflow-x-auto shadow-inner">
                      <div className="flex items-center justify-between text-[10px] text-[#64748b] dark:text-[#94a3b8] mb-2 pb-1 border-b border-[#1e293b]">
                        <span>{currentMcq.codeLanguage?.toUpperCase() || "CODE"}</span>
                      </div>
                      <pre className="whitespace-pre">{currentMcq.codeSnippet}</pre>
                    </div>
                  )}
                </div>

                {/* Options List */}
                <div className="space-y-3 pt-2">
                  <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider font-mono">
                    Select the correct answer:
                  </span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {currentMcq.options.map((option, optIdx) => {
                      const isSelected = mcqAnswers[currentMcq.id] === option.id;
                      const letter = String.fromCharCode(65 + optIdx); // A, B, C, D

                      return (
                        <div
                          key={option.id}
                          onClick={() => handleSelectOption(currentMcq.id, option.id)}
                          className={`flex items-start gap-3.5 p-4 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-500/10 dark:bg-blue-500/15 border-blue-500 text-blue-900 dark:text-blue-100 font-medium shadow-xs"
                              : "bg-white dark:bg-[#121824] border-[#e2e8f0] dark:border-[#1e293b] text-[#334155] dark:text-[#cbd5e1] hover:border-blue-400 dark:hover:border-blue-600 hover:bg-[#f8fafc] dark:hover:bg-[#1a2233]"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-xs"
                                : "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#64748b] dark:text-[#94a3b8]"
                            }`}
                          >
                            {letter}
                          </span>
                          <div className="flex-1 space-y-1 mt-0.5">
                            {option.text && <p className="leading-relaxed">{option.text}</p>}
                            {option.code && (
                              <pre className="font-mono text-xs bg-[#0e1420] text-blue-100 p-2.5 rounded-lg overflow-x-auto whitespace-pre">
                                {option.code}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Bottom Navigation Toolbar */}
              <div className="flex items-center justify-between gap-4 pt-8 mt-6 border-t border-[#e2e8f0] dark:border-[#1e293b]">
                <button
                  type="button"
                  disabled={currentMcqIdx === 0}
                  onClick={() => setCurrentMcqIdx((prev) => Math.max(0, prev - 1))}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-xs font-semibold text-[#0f172a] dark:text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-[#1a2233] cursor-pointer shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleClearOption(currentMcq.id)}
                  disabled={!(currentMcq.id in mcqAnswers)}
                  className="text-xs text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 font-semibold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  Clear Selection
                </button>

                {currentMcqIdx < mcqQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentMcqIdx((prev) => Math.min(mcqQuestions.length - 1, prev + 1))}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
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

      {/* 3. SECTION 2: CODING WORKSPACE */}
      {activeSection === "coding" && (
        <div className="flex-1 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
          {/* Coding Problem Selector Tabs with Titles */}
          <div className="border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 py-2 shadow-2xs">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase font-mono mr-1 shrink-0">
                  Problems:
                </span>
                {codingQuestions.map((q, idx) => {
                  const isCurrent = currentCodingIdx === idx;
                  const isSubmitted = q.id in codingSubmissions;

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
                      <span className="truncate max-w-[160px]">{q.title}</span>
                      <span
                        className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded font-bold ${
                          isCurrent
                            ? "bg-white/20 text-white"
                            : "bg-[#e2e8f0] dark:bg-[#232f45] text-[#475569] dark:text-[#94a3b8]"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      {isSubmitted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>

              {mcqQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveSection("mcq")}
                  className="hidden sm:flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Switch to MCQs ({mcqAnsweredCount}/{mcqQuestions.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Embedded Full Compiler Template */}
          <div className="flex-1 overflow-hidden">
            {currentCodingAsQuestionData ? (
              <StudentWorkspace
                key={currentCodingAsQuestionData.id}
                question={currentCodingAsQuestionData}
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

      {/* 4. Final Submission Confirmation Modal */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-5 animate-in fade-in-50 zoom-in-95">
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
                Review your completion status below before final submission. Once submitted, your answers cannot be modified.
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
                    Coding Problems
                  </span>
                  <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {codingQuestions.length} Total
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
