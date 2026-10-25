"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  LogOut,
  CheckCircle2,
  Terminal,
  History,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  Check,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QuestionPane, QuestionData } from "./QuestionPane";
import { EditorPane } from "./EditorPane";
import { getStoredStudent, AUTH_CHANGE_EVENT, authApi } from "@/services/authApi";
import { AuthModal } from "@/components/AuthModal";
import type { Student } from "@/types/auth";
import {
  submissionsApi,
  Submission,
  SubmissionSummary,
  isTerminalStatus,
  SubmissionMode,
} from "@/services/submissionsApi";

interface StudentWorkspaceProps {
  question: QuestionData;
  onBackToCatalog?: () => void;
  initialSubmissions?: SubmissionSummary[];
}

const DEFAULT_CODE: Record<string, string> = {
  c: `#include <stdio.h>
#include <stdlib.h>

// Write your solution here
`,
  python: `class Solution:
    def solution(self):
        # Write your solution here
`,
  java: `class Solution {
    public void solution() {
        // Write your solution here
    }
}
`,
  cpp: `class Solution {
public:
    void solution() {
        // Write your solution here
    }
};
`,
  node: `/**
 * @return {void}
 */
var solution = function() {
    // Write your solution here
};
`,
};

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACCEPTED: {
    bg: "bg-[#ecfdf5] dark:bg-[#10b981]/15",
    text: "text-[#047857] dark:text-[#34d399]",
    border: "border-[#a7f3d0] dark:border-[#10b981]/25",
  },
  WRONG_ANSWER: {
    bg: "bg-[#fef2f2] dark:bg-[#f43f5e]/15",
    text: "text-[#b91c1c] dark:text-[#fb7185]",
    border: "border-[#fecaca] dark:border-[#f43f5e]/25",
  },
  COMPILE_ERROR: {
    bg: "bg-[#fffbeb] dark:bg-[#f59e0b]/15",
    text: "text-[#b45309] dark:text-[#fbbf24]",
    border: "border-[#fde68a] dark:border-[#f59e0b]/25",
  },
  RUNTIME_ERROR: {
    bg: "bg-[#fef2f2] dark:bg-[#f43f5e]/15",
    text: "text-[#b91c1c] dark:text-[#fb7185]",
    border: "border-[#fecaca] dark:border-[#f43f5e]/25",
  },
  TIME_LIMIT_EXCEEDED: {
    bg: "bg-[#fffbeb] dark:bg-[#f59e0b]/15",
    text: "text-[#b45309] dark:text-[#fbbf24]",
    border: "border-[#fde68a] dark:border-[#f59e0b]/25",
  },
  MEMORY_LIMIT_EXCEEDED: {
    bg: "bg-[#fffbeb] dark:bg-[#f59e0b]/15",
    text: "text-[#b45309] dark:text-[#fbbf24]",
    border: "border-[#fde68a] dark:border-[#f59e0b]/25",
  },
  OUTPUT_LIMIT_EXCEEDED: {
    bg: "bg-[#fffbeb] dark:bg-[#f59e0b]/15",
    text: "text-[#b45309] dark:text-[#fbbf24]",
    border: "border-[#fde68a] dark:border-[#f59e0b]/25",
  },
  SYSTEM_ERROR: {
    bg: "bg-[#fef2f2] dark:bg-[#f43f5e]/15",
    text: "text-[#b91c1c] dark:text-[#fb7185]",
    border: "border-[#fecaca] dark:border-[#f43f5e]/25",
  },
  QUEUED: {
    bg: "bg-[#eff6ff] dark:bg-[#3b82f6]/15",
    text: "text-[#1d4ed8] dark:text-[#60a5fa]",
    border: "border-[#bfdbfe] dark:border-[#3b82f6]/25",
  },
  RUNNING: {
    bg: "bg-[#eff6ff] dark:bg-[#3b82f6]/15",
    text: "text-[#1d4ed8] dark:text-[#60a5fa]",
    border: "border-[#bfdbfe] dark:border-[#3b82f6]/25",
  },
  FAILED: {
    bg: "bg-[#fef2f2] dark:bg-[#f43f5e]/15",
    text: "text-[#b91c1c] dark:text-[#fb7185]",
    border: "border-[#fecaca] dark:border-[#f43f5e]/25",
  },
  IDLE: {
    bg: "bg-[#f1f5f9] dark:bg-[#161e2e]",
    text: "text-[#64748b] dark:text-[#94a3b8]",
    border: "border-[#e2e8f0] dark:border-[#1e293b]",
  },
};

function formatVerdict(v?: string): string {
  if (!v) return "";
  switch (v) {
    case "ACCEPTED":
      return "Accepted";
    case "WRONG_ANSWER":
      return "Wrong answer";
    case "COMPILE_ERROR":
      return "Compile error";
    case "RUNTIME_ERROR":
      return "Runtime error";
    case "TIME_LIMIT_EXCEEDED":
      return "Time limit exceeded";
    case "MEMORY_LIMIT_EXCEEDED":
      return "Memory limit exceeded";
    case "OUTPUT_LIMIT_EXCEEDED":
      return "Output limit exceeded";
    case "SYSTEM_ERROR":
      return "System error";
    case "QUEUED":
      return "Queued";
    case "RUNNING":
      return "Evaluating";
    case "FAILED":
      return "Failed";
    default:
      return v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");
  }
}

function cleanStarter(codeStr?: string): string {
  if (!codeStr) return "";
  return codeStr.replace(/^\s*pass\s*$/gm, "");
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({
  question,
  onBackToCatalog,
  initialSubmissions,
}) => {
  const [student, setStudent] = useState<Student | null>(() => getStoredStudent());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [language, setLanguage] = useState("python");

  const getStarterCode = useCallback(
    (lang: string) => {
      const raw = question.starterCode?.[lang] || DEFAULT_CODE[lang] || "";
      return lang === "python" ? cleanStarter(raw) : raw;
    },
    [question.starterCode]
  );

  // Initialize starter template per language
  const computeInitialCodes = useCallback(() => {
    const supported = ["c", "python", "java", "cpp", "node"];
    const initial: Record<string, string> = {};
    for (const l of supported) {
      initial[l] = getStarterCode(l);
    }
    return initial;
  }, [getStarterCode]);

  // Independent code buffer per language so switching tabs NEVER loses code!
  const [codes, setCodes] = useState<Record<string, string>>(computeInitialCodes);

  const [currentSubmission, setCurrentSubmission] = useState<Partial<Submission> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

  // Submissions drawer tabs & history state
  const [submissionsHistory, setSubmissionsHistory] = useState<SubmissionSummary[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [bottomTab, setBottomTab] = useState<"console" | "submissions">("console");
  const bottomTabRef = useRef<"console" | "submissions">(bottomTab);
  useEffect(() => {
    bottomTabRef.current = bottomTab;
  }, [bottomTab]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<"problem" | "code" | "results">("problem");
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [loadingDetailsSubId, setLoadingDetailsSubId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState<"cases" | "code">("cases");
  const [dialogCaseIdx, setDialogCaseIdx] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Pagination for submissions (10 per page, descending order of submission date)
  const SUBMISSIONS_PER_PAGE = 10;
  const [submissionsPage, setSubmissionsPage] = useState<number>(1);

  const sortedSubmissions = useMemo(() => {
    return [...submissionsHistory].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [submissionsHistory]);

  const totalPages = Math.max(1, Math.ceil(sortedSubmissions.length / SUBMISSIONS_PER_PAGE));
  const validPage = Math.min(Math.max(1, submissionsPage), totalPages);
  const startIndex = (validPage - 1) * SUBMISSIONS_PER_PAGE;
  const currentSubmissions = sortedSubmissions.slice(startIndex, startIndex + SUBMISSIONS_PER_PAGE);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (validPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", validPage - 1, validPage, validPage + 1, "...", totalPages];
  }, [totalPages, validPage]);

  const submissionsLoadedRef = useRef<boolean>(false);
  const submissionsStaleRef = useRef<boolean>(true);
  const activePollIdRef = useRef<number>(0);
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleAuthChange = () => setStudent(getStoredStudent());
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  }, []);

  const cleanupPolling = useCallback(() => {
    activePollIdRef.current++;
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupPolling();
  }, [cleanupPolling]);

  // Fetch past submissions ONLY when explicitly called (e.g. user clicks Submissions tab or Refresh)
  const loadSubmissions = useCallback(async () => {
    if (!student) return;
    setLoadingSubmissions(true);
    try {
      const userIdent = student.id || (student as any)._id || student.email || student.studentId;
      const list = await submissionsApi.list({
        questionId: question.id,
        userId: userIdent,
        mode: "SUBMIT",
        limit: 200,
      });
      const allSubmissions = list || [];
      const submitsOnly = allSubmissions.filter((s) => s.mode === "SUBMIT");
      setSubmissionsHistory(submitsOnly);
      submissionsLoadedRef.current = true;
      submissionsStaleRef.current = false;
    } catch (err) {
      console.error("Failed to load submissions history", err);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [question.id, student]);

  // When question changes, reset workspace state
  useEffect(() => {
    setCurrentSubmission(null);
    setErrorNotice(null);
    setSelectedCaseIdx(0);
    setSubmissionsHistory([]);
    setSubmissionsPage(1);
    submissionsLoadedRef.current = false;
    submissionsStaleRef.current = true;
    cleanupPolling();
  }, [question.id, cleanupPolling]);

  const currentCode = codes[language] ?? getStarterCode(language);

  const handleLanguageChange = useCallback((newLang: string) => {
    setLanguage(newLang);
    setSelectedCaseIdx(0);
  }, []);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCodes((prev) => ({
        ...prev,
        [language]: newCode,
      }));
    },
    [language]
  );

  // Reset button: resets ONLY the active language to its template
  const handleReset = useCallback(() => {
    const template = getStarterCode(language);
    setCodes((prev) => ({
      ...prev,
      [language]: template,
    }));
    setRestoredNotice(`Reset ${language.toUpperCase()} code to starter template`);
    setTimeout(() => setRestoredNotice(null), 3000);
  }, [language, getStarterCode]);

  const restoreSubmissionToEditor = useCallback(
    (sub: Submission) => {
      setLanguage(sub.language);
      setCodes((prev) => ({
        ...prev,
        [sub.language]: sub.sourceCode,
      }));
      setRestoredNotice(`Loaded ${sub.language.toUpperCase()} submission into editor`);
      setTimeout(() => setRestoredNotice(null), 3500);
      setViewingSubmission(null);
    },
    []
  );

  const handleViewSubmission = useCallback(async (subId: string) => {
    setLoadingDetailsSubId(subId);
    try {
      const full = await submissionsApi.get(subId);
      setViewingSubmission(full);
      setDialogTab("cases");
      setDialogCaseIdx(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load submission details.";
      setErrorNotice(msg);
    } finally {
      setLoadingDetailsSubId(null);
    }
  }, []);

  const handleRestoreSubmission = useCallback(
    async (sub: SubmissionSummary | Submission) => {
      setLoadingDetailsSubId(sub.id);
      try {
        let full: Submission;
        if ("sourceCode" in sub && (sub as Submission).sourceCode) {
          full = sub as Submission;
        } else {
          full = await submissionsApi.get(sub.id);
        }
        restoreSubmissionToEditor(full);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to restore submission.";
        setErrorNotice(msg);
      } finally {
        setLoadingDetailsSubId(null);
      }
    },
    [restoreSubmissionToEditor]
  );

  const triggerExecution = useCallback(
    async (mode: SubmissionMode) => {
      if (isRunning) return;
      if (!student) {
        setErrorNotice("Please sign in to execute code.");
        setAuthModalOpen(true);
        return;
      }
      cleanupPolling();
      setIsRunning(true);
      setErrorNotice(null);
      setSelectedCaseIdx(0);
      setBottomTab("console");
      setIsDrawerOpen(true);
      setMobileTab("results");
      setCurrentSubmission({ status: "QUEUED", mode });

      const currentPollId = ++activePollIdRef.current;
      try {
        const userIdent = student ? (student.id || (student as any)._id || student.email || student.studentId) : undefined;
        const createRes = await submissionsApi.create({
          questionId: question.id,
          language,
          mode,
          sourceCode: currentCode,
          userId: userIdent,
        });

        const subId = createRes.submissionId;
        setCurrentSubmission({ id: subId, status: createRes.status, mode });

        // Sequential polling loop: wait for response, keep interval >= 1s without overlapping
        let isDone = false;
        let attempts = 0;
        const MAX_POLLS = 60; // 60 attempts safety guard

        while (!isDone && attempts < MAX_POLLS && activePollIdRef.current === currentPollId) {
          attempts++;
          const callStart = Date.now();
          let sub: Submission | null = null;
          try {
            sub = await submissionsApi.get(subId);
            if (activePollIdRef.current !== currentPollId) break;
            setCurrentSubmission(sub);
          } catch (pollErr: unknown) {
            if (activePollIdRef.current !== currentPollId) break;
            const message = pollErr instanceof Error ? pollErr.message : "Unknown polling error.";
            setCurrentSubmission((submission) =>
              submission
                ? {
                    ...submission,
                    errorMessage: `Status unavailable for submission ${subId}: ${message}`,
                  }
                : submission
            );
            setErrorNotice(`Failed to fetch status for submission ${subId}: ${message}`);
            isDone = true;
            break;
          }

          if (isTerminalStatus(sub.status)) {
            isDone = true;
            if (sub.testResults && sub.testResults.length > 0) {
              const firstFail = sub.testResults.findIndex((tc) => !tc.passed);
              setSelectedCaseIdx(firstFail >= 0 ? firstFail : 0);
            }

            // Immediately prepend completed submission into history if mode === "SUBMIT"
            if (mode === "SUBMIT" && sub.id) {
              const newSummary: SubmissionSummary = {
                id: sub.id,
                userId: sub.userId || student?.id || "",
                userEmail: sub.userEmail || student?.email,
                questionId: sub.questionId,
                language: sub.language,
                mode: "SUBMIT",
                status: sub.status,
                verdict: sub.verdict,
                executionTimeMs: sub.executionTimeMs,
                tests: sub.tests || { total: 0, passed: 0, failed: 0 },
                createdAt: sub.createdAt || new Date().toISOString(),
              };
              setSubmissionsHistory((prev) => [
                newSummary,
                ...prev.filter((item) => item.id !== sub.id),
              ]);
              setSubmissionsPage(1);
              submissionsLoadedRef.current = true;
              submissionsStaleRef.current = false;
            }

            // Also refresh from backend in background
            void loadSubmissions();
            break;
          }

          // Maintain at least 1s between polling calls, but don't add redundant delay if call took >=1000ms
          const callDuration = Date.now() - callStart;
          const waitTime = Math.max(0, 1000 - callDuration);
          if (waitTime > 0) {
            await new Promise((resolve) => {
              pollTimeoutRef.current = setTimeout(resolve, waitTime);
            });
          }
        }

        if (!isDone && attempts >= MAX_POLLS && activePollIdRef.current === currentPollId) {
          setErrorNotice("Execution timed out. Please try running again.");
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown submission error.";
        setErrorNotice(message);
        setCurrentSubmission((submission) => ({
          ...(submission ?? {}),
          status: "FAILED",
          errorMessage: message,
        }));
      } finally {
        if (activePollIdRef.current === currentPollId) {
          setIsRunning(false);
        }
      }
    },
    [isRunning, cleanupPolling, student, question.id, language, currentCode, loadSubmissions]
  );

  const handleRun = useCallback(() => triggerExecution("RUN"), [triggerExecution]);
  const handleSubmit = useCallback(() => triggerExecution("SUBMIT"), [triggerExecution]);

  const isSolved = submissionsHistory.some((s) => s.verdict === "ACCEPTED");

  const statusKey = currentSubmission?.verdict || currentSubmission?.status || "IDLE";
  const verdictStyle = VERDICT_STYLES[statusKey] || VERDICT_STYLES["IDLE"];
  const statusLabel = currentSubmission?.status;

  const copyCodeToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const renderDrawerContent = () => (
    <div className="flex flex-col h-full">
      {/* 1. CONSOLE / TEST RESULTS TAB */}
      {bottomTab === "console" && (
        <div>
          {!currentSubmission ? (
            <div className="py-10 text-center text-[#64748b] dark:text-[#94a3b8] text-xs">
              Click &quot;Run&quot; to test your solution with sample test cases or &quot;Submit&quot; for complete evaluation.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* Top Verdict & Summary Bar */}
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${verdictStyle.border} ${verdictStyle.bg} ${verdictStyle.text}`}
                  >
                    {formatVerdict(currentSubmission.verdict || currentSubmission.status)}
                  </span>

                  {currentSubmission.executionTimeMs != null && (
                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8] font-mono">
                      Runtime: {currentSubmission.executionTimeMs} ms
                    </span>
                  )}

                  {currentSubmission.tests && (
                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                      Tests:{" "}
                      <span
                        className={
                          currentSubmission.tests.passed === currentSubmission.tests.total
                            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                            : "text-amber-600 dark:text-amber-400 font-semibold"
                        }
                      >
                        {currentSubmission.tests.passed}
                      </span>{" "}
                      of {currentSubmission.tests.total} passed
                    </span>
                  )}
                </div>

                {isRunning && (
                  <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                    Evaluating solution in sandbox...
                  </div>
                )}
              </div>

              {/* Compile Error Output */}
              {currentSubmission.compileOutput && (
                <div className="mb-2">
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                    Compilation output:
                  </div>
                  <pre className="font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 p-2.5 rounded-lg border border-rose-500/25 whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {currentSubmission.compileOutput}
                  </pre>
                </div>
              )}

              {/* System / Execution Error */}
              {currentSubmission.errorMessage && (
                <div className="mb-2">
                  <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                    Error message:
                  </div>
                  <pre className="font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 p-2.5 rounded-lg border border-rose-500/25 whitespace-pre-wrap max-h-36 overflow-y-auto">
                    {currentSubmission.errorMessage}
                  </pre>
                </div>
              )}

              {/* Individual Test Cases Viewer */}
              {currentSubmission.testResults && currentSubmission.testResults.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {/* Test Case Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                    {currentSubmission.testResults.map((tc, idx) => {
                      const isSelected = idx === selectedCaseIdx;
                      return (
                        <button
                          key={tc.id || idx}
                          type="button"
                          onClick={() => setSelectedCaseIdx(idx)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                              : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white border border-transparent"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              tc.passed ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span>Case {idx + 1}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                              tc.passed
                                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                : "text-rose-700 dark:text-rose-300 bg-rose-500/10"
                            }`}
                          >
                            {tc.passed ? "Passed" : "Failed"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Test Case Detail */}
                  {currentSubmission.testResults[selectedCaseIdx] && (() => {
                    const activeCase = currentSubmission.testResults[selectedCaseIdx];
                    return (
                      <div className="flex flex-col gap-2.5 pt-1">
                        {/* Input */}
                        <div>
                          <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                            Input:
                          </div>
                          <pre className="bg-[#f8fafc] dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-2.5 rounded-lg text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] whitespace-pre-wrap">
                            {activeCase.input != null ? activeCase.input : "(Hidden test case)"}
                          </pre>
                        </div>

                        {/* Expected vs Actual Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                              Expected output:
                            </div>
                            <pre className="bg-[#f8fafc] dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] p-2.5 rounded-lg text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] whitespace-pre-wrap">
                              {activeCase.expectedOutput != null
                                ? activeCase.expectedOutput
                                : "(Hidden test case)"}
                            </pre>
                          </div>

                          <div>
                            <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1 flex items-center justify-between">
                              <span>Your output:</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                                  activeCase.passed
                                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                                    : "text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20"
                                }`}
                              >
                                {activeCase.passed ? "Match" : "Mismatch"}
                              </span>
                            </div>
                            <pre
                              className={`p-2.5 rounded-lg text-xs font-mono whitespace-pre-wrap border ${
                                activeCase.passed
                                  ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : "bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
                              }`}
                            >
                              {activeCase.actualOutput != null && activeCase.actualOutput.length > 0
                                ? activeCase.actualOutput
                                : "(No stdout printed)"}
                            </pre>
                          </div>
                        </div>

                        {/* Diagnostics / Stderr */}
                        {activeCase.error && (
                          <div>
                            <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1">
                              Diagnostics / stderr:
                            </div>
                            <pre className="bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 p-2.5 rounded-lg text-xs font-mono whitespace-pre-wrap">
                              {activeCase.error}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. SUBMISSIONS HISTORY TAB */}
      {bottomTab === "submissions" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
              Past submissions ({sortedSubmissions.length})
              {totalPages > 1 && (
                <span className="ml-1.5 text-[#64748b] dark:text-[#94a3b8] font-normal">
                  · Page {validPage} of {totalPages}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => void loadSubmissions()}
              disabled={loadingSubmissions}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold disabled:opacity-50 cursor-pointer"
            >
              {loadingSubmissions ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingSubmissions && sortedSubmissions.length === 0 ? (
            <div className="py-8 text-center text-[#64748b] dark:text-[#94a3b8] text-xs">
              Loading submission history...
            </div>
          ) : sortedSubmissions.length === 0 ? (
            <div className="py-8 text-center text-[#64748b] dark:text-[#94a3b8] text-xs">
              No submissions yet. Submit your code to track results and save solution progress.
            </div>
          ) : (
            <div className="border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl overflow-hidden bg-white dark:bg-[#121824]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fafc] dark:bg-[#0b0f17] border-b border-[#e2e8f0] dark:border-[#1e293b] text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  <tr>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Language</th>
                    <th className="px-3.5 py-2.5">Runtime</th>
                    <th className="px-3.5 py-2.5">Tests</th>
                    <th className="px-3.5 py-2.5">Submitted</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b]">
                  {currentSubmissions.map((sub) => {
                    const vKey = sub.verdict || sub.status;
                    const vStyle = VERDICT_STYLES[vKey] || VERDICT_STYLES["IDLE"];
                    const dateStr = sub.createdAt
                      ? new Date(sub.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-";

                    return (
                      <tr key={sub.id} className="hover:bg-[#f8fafc] dark:hover:bg-[#161f30] transition-colors">
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${vStyle.border} ${vStyle.bg} ${vStyle.text}`}
                          >
                            {sub.verdict === "ACCEPTED" && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {formatVerdict(sub.verdict || sub.status)}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[#0f172a] dark:text-[#f8fafc]">
                          {sub.language}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#64748b] dark:text-[#94a3b8] font-mono">
                          {sub.executionTimeMs != null ? `${sub.executionTimeMs} ms` : "-"}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#64748b] dark:text-[#94a3b8] font-mono">
                          {sub.tests
                            ? `${sub.tests.passed} / ${sub.tests.total}`
                            : "-"}
                        </td>
                        <td className="px-3.5 py-2.5 text-[#64748b] dark:text-[#94a3b8] text-[11px]">
                          {dateStr}
                        </td>
                        <td className="px-3.5 py-2.5 text-right space-x-1.5">
                          <button
                            type="button"
                            disabled={loadingDetailsSubId === sub.id}
                            onClick={() => void handleViewSubmission(sub.id)}
                            className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1a2233] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] text-[#0f172a] dark:text-white text-[11px] font-semibold border border-[#e2e8f0] dark:border-[#232f45] transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {loadingDetailsSubId === sub.id ? "Loading..." : "View details"}
                          </button>
                          <button
                            type="button"
                            disabled={loadingDetailsSubId === sub.id}
                            onClick={() => void handleRestoreSubmission(sub)}
                            className="px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 text-[11px] font-semibold border border-blue-500/30 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-t border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] text-xs">
                  <div className="text-[#64748b] dark:text-[#94a3b8]">
                    Showing{" "}
                    <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {startIndex + 1}
                    </span>
                    –
                    <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {Math.min(startIndex + SUBMISSIONS_PER_PAGE, sortedSubmissions.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {sortedSubmissions.length}
                    </span>{" "}
                    submissions
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={validPage === 1}
                      onClick={() => setSubmissionsPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {pageNumbers.map((p, idx) =>
                        typeof p === "number" ? (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setSubmissionsPage(p)}
                            className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              p === validPage
                                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                : "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-[#f8fafc] border-[#e2e8f0] dark:border-[#232f45] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45]"
                            }`}
                          >
                            {p}
                          </button>
                        ) : (
                          <span key={`ellipsis-${idx}`} className="px-1 text-[#64748b] dark:text-[#94a3b8]">
                            ...
                          </span>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={validPage === totalPages}
                      onClick={() => setSubmissionsPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#e2e8f0] dark:border-[#232f45] bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-[#f8fafc] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const difficultyLabel =
    question.difficulty.charAt(0) + question.difficulty.slice(1).toLowerCase();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] transition-colors duration-200">
      {/* Top Header Bar */}
      <header className="h-12 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] flex items-center px-4 gap-3 flex-shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          {onBackToCatalog ? (
            <button
              onClick={onBackToCatalog}
              type="button"
              className="px-2.5 py-1 text-xs font-semibold text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] rounded-lg transition-all cursor-pointer"
            >
              ← Problems
            </button>
          ) : (
            <Link
              href="/"
              className="px-2.5 py-1 text-xs font-semibold text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] rounded-lg transition-all"
            >
              ← Problems
            </Link>
          )}

          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-xs shadow-blue-600/25">
            Z
          </span>

          <div className="h-4 w-px bg-[#e2e8f0] dark:bg-[#1e293b]" />

          <span className="text-xs font-bold truncate max-w-sm text-[#0f172a] dark:text-white">
            {question.title}
          </span>

          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
              question.difficulty === "HARD"
                ? "text-[#b91c1c] dark:text-[#fb7185] bg-[#fef2f2] dark:bg-[#f43f5e]/15 border-[#fecaca] dark:border-[#f43f5e]/25"
                : question.difficulty === "MEDIUM"
                ? "text-[#b45309] dark:text-[#fbbf24] bg-[#fffbeb] dark:bg-[#f59e0b]/15 border-[#fde68a] dark:border-[#f59e0b]/25"
                : "text-[#047857] dark:text-[#34d399] bg-[#ecfdf5] dark:bg-[#10b981]/15 border-[#a7f3d0] dark:border-[#10b981]/25"
            }`}
          >
            {difficultyLabel}
          </span>

          {isSolved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Solved</span>
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {restoredNotice && (
            <span className="hidden sm:inline-block text-xs text-emerald-700 dark:text-emerald-300 font-mono px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
              {restoredNotice}
            </span>
          )}

          {errorNotice && (
            <span className="text-xs text-rose-700 dark:text-rose-300 font-mono px-2 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
              {errorNotice}
            </span>
          )}

          {student ? (
            <div className="hidden sm:flex items-center gap-2 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs shadow-xs">
              <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white">
                {student.name}
              </span>
              <span className="text-[#94a3b8] text-[10px] font-mono">
                {student.studentId}
              </span>
              <button
                onClick={() => {
                  authApi.logout();
                  if (onBackToCatalog) onBackToCatalog();
                }}
                title="Sign out"
                type="button"
                className="ml-1 text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              type="button"
              className="text-xs font-semibold bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-500 shadow-xs shadow-blue-600/20 cursor-pointer"
            >
              Sign in
            </button>
          )}

          <EnvironmentSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Segmented Navigation Bar (Only on mobile < md) - Option A */}
      <div className="flex md:hidden items-center justify-around bg-white dark:bg-[#121824] border-b border-[#e2e8f0] dark:border-[#1e293b] p-1 flex-shrink-0 text-xs shadow-xs">
        <button
          type="button"
          onClick={() => setMobileTab("problem")}
          className={`flex-1 py-1.5 text-center font-semibold rounded-lg transition-all ${
            mobileTab === "problem"
              ? "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
              : "text-[#64748b] dark:text-[#94a3b8]"
          }`}
        >
          Problem
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("code")}
          className={`flex-1 py-1.5 text-center font-semibold rounded-lg transition-all ${
            mobileTab === "code"
              ? "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
              : "text-[#64748b] dark:text-[#94a3b8]"
          }`}
        >
          Code
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab("results");
            setIsDrawerOpen(true);
          }}
          className={`flex-1 py-1.5 text-center font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === "results"
              ? "bg-[#f1f5f9] dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
              : "text-[#64748b] dark:text-[#94a3b8]"
          }`}
        >
          <span>Results</span>
          {currentSubmission?.verdict && (
            <span
              className={`w-2 h-2 rounded-full ${
                currentSubmission.verdict === "ACCEPTED"
                  ? "bg-emerald-500"
                  : "bg-rose-500"
              }`}
            />
          )}
        </button>
      </div>

      {/* Main Content Workspace (Desktop view: 2-column split with collapsible dock) */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        {/* Left Question Pane */}
        <div className="w-[40%] min-w-[300px] max-w-[600px] overflow-hidden">
          <QuestionPane question={question} />
        </div>

        {/* Divider */}
        <div className="w-px bg-[#e2e8f0] dark:bg-[#1e293b] flex-shrink-0" />

        {/* Right Editor + Output & Submissions Drawer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <EditorPane
              language={language}
              onLanguageChange={handleLanguageChange}
              code={currentCode}
              onCodeChange={handleCodeChange}
              onRun={handleRun}
              onSubmit={handleSubmit}
              onReset={handleReset}
              isRunning={isRunning}
              statusText={statusLabel}
            />
          </div>

          {/* Option A: Collapsible Bottom Console Dock */}
          <div className="border-t border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] flex-shrink-0 flex flex-col transition-colors">
            {/* Tab Toolbar */}
            <div className="h-10 px-4 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("console");
                    setIsDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    bottomTab === "console" && isDrawerOpen
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Test results & console</span>
                  {currentSubmission?.status && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${verdictStyle.text}`}>
                      ({formatVerdict(currentSubmission.verdict || currentSubmission.status)})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("submissions");
                    setIsDrawerOpen(true);
                    void loadSubmissions();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    bottomTab === "submissions" && isDrawerOpen
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Submissions</span>
                  <span className="text-[10px] bg-[#f1f5f9] dark:bg-[#1a2233] text-[#64748b] dark:text-[#94a3b8] px-1.5 py-0.2 rounded-md border border-[#e2e8f0] dark:border-[#232f45]">
                    {submissionsLoadedRef.current ? submissionsHistory.length : "•"}
                  </span>
                  {isSolved && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                title={isDrawerOpen ? "Collapse drawer" : "Expand drawer"}
                className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white p-1 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] transition-colors cursor-pointer"
              >
                {isDrawerOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Expanded Drawer Content */}
            {isDrawerOpen && (
              <div
                className="bg-white dark:bg-[#0b0f17] px-4 py-3 overflow-y-auto"
                style={{ height: "260px" }}
              >
                {renderDrawerContent()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Content (Only on mobile < md) - Option A Segmented Tabs */}
      <div className="flex md:hidden flex-1 overflow-hidden flex-col">
        {mobileTab === "problem" && (
          <div className="flex-1 overflow-hidden">
            <QuestionPane question={question} />
          </div>
        )}
        {mobileTab === "code" && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <EditorPane
              language={language}
              onLanguageChange={handleLanguageChange}
              code={currentCode}
              onCodeChange={handleCodeChange}
              onRun={handleRun}
              onSubmit={handleSubmit}
              onReset={handleReset}
              isRunning={isRunning}
              statusText={statusLabel}
            />
          </div>
        )}
        {mobileTab === "results" && (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0b0f17] flex flex-col">
            <div className="h-10 px-4 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824] flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBottomTab("console")}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    bottomTab === "console"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Console</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("submissions");
                    void loadSubmissions();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    bottomTab === "submissions"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Submissions</span>
                  <span className="text-[10px] bg-[#f1f5f9] dark:bg-[#1a2233] text-[#64748b] dark:text-[#94a3b8] px-1.5 py-0.2 rounded-md border border-[#e2e8f0] dark:border-[#232f45]">
                    {submissionsLoadedRef.current ? submissionsHistory.length : "•"}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex-1 px-4 py-3 overflow-y-auto">
              {renderDrawerContent()}
            </div>
          </div>
        )}
      </div>

      {/* Submission Details Modal with Test Results & Code */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl w-full max-w-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden text-[#0f172a] dark:text-[#f8fafc]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Code2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-[#0f172a] dark:text-white">
                  Submission details ({viewingSubmission.language})
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                    VERDICT_STYLES[viewingSubmission.verdict || "IDLE"]?.text
                  } ${VERDICT_STYLES[viewingSubmission.verdict || "IDLE"]?.bg} ${
                    VERDICT_STYLES[viewingSubmission.verdict || "IDLE"]?.border
                  }`}
                >
                  {formatVerdict(viewingSubmission.verdict || viewingSubmission.status)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white p-1 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 px-5 py-3 bg-[#f8fafc] dark:bg-[#0b0f17] border-b border-[#e2e8f0] dark:border-[#1e293b] text-xs">
              <div>
                <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase tracking-wider font-semibold">
                  Runtime
                </span>
                <span className="font-mono text-[#0f172a] dark:text-[#f8fafc] font-semibold">
                  {viewingSubmission.executionTimeMs != null
                    ? `${viewingSubmission.executionTimeMs} ms`
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase tracking-wider font-semibold">
                  Tests passed
                </span>
                <span className="font-mono text-[#0f172a] dark:text-[#f8fafc] font-semibold">
                  {viewingSubmission.tests
                    ? `${viewingSubmission.tests.passed} / ${viewingSubmission.tests.total}`
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-[#64748b] dark:text-[#94a3b8] block text-[10px] uppercase tracking-wider font-semibold">
                  Submitted at
                </span>
                <span className="text-[#0f172a] dark:text-[#f8fafc] text-[11px] font-semibold">
                  {viewingSubmission.createdAt
                    ? new Date(viewingSubmission.createdAt).toLocaleString()
                    : "-"}
                </span>
              </div>
            </div>

            {/* Modal Navigation Tabs: Test Results vs Code */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824]">
              <button
                type="button"
                onClick={() => setDialogTab("cases")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  dialogTab === "cases"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Test results & data</span>
                {viewingSubmission.tests && (
                  <span className="text-[10px] opacity-90">
                    ({viewingSubmission.tests.passed}/{viewingSubmission.tests.total})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDialogTab("code")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  dialogTab === "code"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Submitted code</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3 bg-white dark:bg-[#121824]">
              {dialogTab === "cases" ? (
                <div>
                  {/* Compile Output */}
                  {viewingSubmission.compileOutput && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                        Compilation output:
                      </div>
                      <pre className="font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 p-2.5 rounded-lg border border-rose-500/25 whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {viewingSubmission.compileOutput}
                      </pre>
                    </div>
                  )}

                  {/* Error Message */}
                  {viewingSubmission.errorMessage && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1">
                        Error message:
                      </div>
                      <pre className="font-mono text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 p-2.5 rounded-lg border border-rose-500/25 whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {viewingSubmission.errorMessage}
                      </pre>
                    </div>
                  )}

                  {/* Test Cases Results with Data */}
                  {viewingSubmission.testResults && viewingSubmission.testResults.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Case selector chips */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-[#e2e8f0] dark:border-[#1e293b]">
                        {viewingSubmission.testResults.map((tc, idx) => {
                          const isSelected = idx === dialogCaseIdx;
                          return (
                            <button
                              key={tc.id || idx}
                              type="button"
                              onClick={() => setDialogCaseIdx(idx)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white border border-transparent"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  tc.passed ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span>Case {idx + 1}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                                  tc.passed
                                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                    : "text-rose-700 dark:text-rose-300 bg-rose-500/10"
                                }`}
                              >
                                {tc.passed ? "Passed" : "Failed"}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Case Detail */}
                      {viewingSubmission.testResults[dialogCaseIdx] && (() => {
                        const activeCase = viewingSubmission.testResults[dialogCaseIdx];
                        return (
                          <div className="flex flex-col gap-2.5 pt-1">
                            {/* Input */}
                            <div>
                              <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                Input:
                              </div>
                              <pre className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-2.5 rounded-lg text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] whitespace-pre-wrap max-h-36 overflow-y-auto">
                                {activeCase.input != null ? activeCase.input : "(Hidden test case input)"}
                              </pre>
                            </div>

                            {/* Expected vs Actual Output */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1">
                                  Expected output:
                                </div>
                                <pre className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-2.5 rounded-lg text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] whitespace-pre-wrap max-h-36 overflow-y-auto">
                                  {activeCase.expectedOutput != null
                                    ? activeCase.expectedOutput
                                    : "(Hidden test case expected output)"}
                                </pre>
                              </div>

                              <div>
                                <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1 flex items-center justify-between">
                                  <span>Your output:</span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                                      activeCase.passed
                                        ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20"
                                        : "text-rose-700 dark:text-rose-300 bg-rose-500/10 border border-rose-500/20"
                                    }`}
                                  >
                                    {activeCase.passed ? "Match" : "Mismatch"}
                                  </span>
                                </div>
                                <pre
                                  className={`p-2.5 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto border ${
                                    activeCase.passed
                                      ? "border-emerald-500/20 text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 dark:bg-emerald-500/10"
                                      : "border-rose-500/20 text-rose-700 dark:text-rose-300 bg-rose-500/5 dark:bg-rose-500/10"
                                  }`}
                                >
                                  {activeCase.actualOutput != null && activeCase.actualOutput.length > 0
                                    ? activeCase.actualOutput
                                    : "(No stdout printed)"}
                                </pre>
                              </div>
                            </div>

                            {/* Error / Diagnostics */}
                            {activeCase.error && (
                              <div>
                                <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1">
                                  Diagnostics / stderr:
                                </div>
                                <pre className="bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 p-2.5 rounded-lg text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                                  {activeCase.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[#64748b] dark:text-[#94a3b8]">
                      No individual test case results recorded for this submission.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8]">
                      Submitted code ({viewingSubmission.language}):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCodeToClipboard(viewingSubmission.sourceCode)}
                      className="flex items-center gap-1.5 text-xs text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white px-2 py-1 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233] cursor-pointer"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] p-3.5 rounded-xl text-xs font-mono text-[#0f172a] dark:text-[#f8fafc] whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {viewingSubmission.sourceCode}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17]">
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#1a2233] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] text-[#0f172a] dark:text-white text-xs font-semibold border border-[#e2e8f0] dark:border-[#232f45] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => restoreSubmissionToEditor(viewingSubmission)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore to editor
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(std) => setStudent(std)}
      />
    </div>
  );
};
