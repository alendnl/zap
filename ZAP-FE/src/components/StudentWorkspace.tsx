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
    bg: "bg-[#dafbe1] dark:bg-[#2ea043]/15",
    text: "text-[#1a7f37] dark:text-[#3fb950]",
    border: "border-[#1a7f37]/25 dark:border-[#3fb950]/30",
  },
  WRONG_ANSWER: {
    bg: "bg-[#ffebe9] dark:bg-[#f85149]/15",
    text: "text-[#cf222e] dark:text-[#f85149]",
    border: "border-[#cf222e]/25 dark:border-[#f85149]/30",
  },
  COMPILE_ERROR: {
    bg: "bg-[#fff8c5] dark:bg-[#bb8009]/15",
    text: "text-[#9a6700] dark:text-[#d29922]",
    border: "border-[#9a6700]/25 dark:border-[#d29922]/30",
  },
  RUNTIME_ERROR: {
    bg: "bg-[#ffebe9] dark:bg-[#f85149]/15",
    text: "text-[#cf222e] dark:text-[#f85149]",
    border: "border-[#cf222e]/25 dark:border-[#f85149]/30",
  },
  TIME_LIMIT_EXCEEDED: {
    bg: "bg-[#fff8c5] dark:bg-[#bb8009]/15",
    text: "text-[#9a6700] dark:text-[#d29922]",
    border: "border-[#9a6700]/25 dark:border-[#d29922]/30",
  },
  MEMORY_LIMIT_EXCEEDED: {
    bg: "bg-[#fff8c5] dark:bg-[#bb8009]/15",
    text: "text-[#9a6700] dark:text-[#d29922]",
    border: "border-[#9a6700]/25 dark:border-[#d29922]/30",
  },
  OUTPUT_LIMIT_EXCEEDED: {
    bg: "bg-[#fff8c5] dark:bg-[#bb8009]/15",
    text: "text-[#9a6700] dark:text-[#d29922]",
    border: "border-[#9a6700]/25 dark:border-[#d29922]/30",
  },
  SYSTEM_ERROR: {
    bg: "bg-[#ffebe9] dark:bg-[#f85149]/15",
    text: "text-[#cf222e] dark:text-[#f85149]",
    border: "border-[#cf222e]/25 dark:border-[#f85149]/30",
  },
  QUEUED: {
    bg: "bg-[#ddf4ff] dark:bg-[#388bfd]/15",
    text: "text-[#0969da] dark:text-[#2f81f7]",
    border: "border-[#0969da]/25 dark:border-[#2f81f7]/30",
  },
  RUNNING: {
    bg: "bg-[#ddf4ff] dark:bg-[#388bfd]/15",
    text: "text-[#0969da] dark:text-[#2f81f7]",
    border: "border-[#0969da]/25 dark:border-[#2f81f7]/30",
  },
  FAILED: {
    bg: "bg-[#ffebe9] dark:bg-[#f85149]/15",
    text: "text-[#cf222e] dark:text-[#f85149]",
    border: "border-[#cf222e]/25 dark:border-[#f85149]/30",
  },
  IDLE: {
    bg: "bg-[#f6f8fa] dark:bg-[#21262d]",
    text: "text-[#656d76] dark:text-[#8b949e]",
    border: "border-[#d0d7de] dark:border-[#30363d]",
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

  const difficultyLabel =
    question.difficulty.charAt(0) + question.difficulty.slice(1).toLowerCase();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f6f8fa] dark:bg-[#0d1117] text-[#1f2328] dark:text-[#e6edf3]">
      {/* Top Header Bar */}
      <header className="h-11 border-b border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] flex items-center px-3.5 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {onBackToCatalog ? (
            <button
              onClick={onBackToCatalog}
              type="button"
              className="px-2 py-0.5 text-xs font-medium text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] bg-[#f6f8fa] dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] rounded transition-colors"
            >
              ← Problems
            </button>
          ) : (
            <Link
              href="/"
              className="px-2 py-0.5 text-xs font-medium text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] bg-[#f6f8fa] dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] rounded transition-colors"
            >
              ← Problems
            </Link>
          )}

          <span className="w-5 h-5 rounded bg-[#0969da] text-white flex items-center justify-center font-mono font-bold text-[11px] select-none">
            Z
          </span>

          <div className="h-3.5 w-px bg-[#d0d7de] dark:bg-[#30363d]" />

          <span className="text-xs font-semibold truncate max-w-sm">
            {question.title}
          </span>

          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
              question.difficulty === "HARD"
                ? "text-[#cf222e] dark:text-[#f85149] bg-[#ffebe9] dark:bg-[#f85149]/15 border-[#cf222e]/20"
                : question.difficulty === "MEDIUM"
                ? "text-[#9a6700] dark:text-[#d29922] bg-[#fff8c5] dark:bg-[#bb8009]/15 border-[#9a6700]/20"
                : "text-[#1a7f37] dark:text-[#3fb950] bg-[#dafbe1] dark:bg-[#2ea043]/15 border-[#1a7f37]/20"
            }`}
          >
            {difficultyLabel}
          </span>

          {isSolved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border border-[#1a7f37]/20 bg-[#dafbe1] dark:bg-[#2ea043]/15 text-[#1a7f37] dark:text-[#3fb950]">
              <CheckCircle2 className="w-3 h-3" />
              <span>Solved</span>
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {restoredNotice && (
            <span className="text-xs text-[#1a7f37] dark:text-[#3fb950] font-mono px-2 py-0.5 rounded bg-[#dafbe1] dark:bg-[#2ea043]/15 border border-[#1a7f37]/20">
              {restoredNotice}
            </span>
          )}

          {errorNotice && (
            <span className="text-xs text-[#cf222e] dark:text-[#f85149] font-mono px-2 py-0.5 rounded bg-[#ffebe9] dark:bg-[#f85149]/15 border border-[#cf222e]/20">
              {errorNotice}
            </span>
          )}

          {student ? (
            <div className="hidden sm:flex items-center gap-2 border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] px-2 py-0.5 rounded text-xs">
              <span className="font-medium text-[11px] text-[#1f2328] dark:text-[#e6edf3]">
                {student.name}
              </span>
              <span className="text-[#8c959f] text-[10px] font-mono">
                {student.studentId}
              </span>
              <button
                onClick={() => {
                  authApi.logout();
                  if (onBackToCatalog) onBackToCatalog();
                }}
                title="Sign out"
                type="button"
                className="ml-1 text-[#656d76] dark:text-[#8b949e] hover:text-[#cf222e] dark:hover:text-[#f85149] p-0.5"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              type="button"
              className="text-xs font-medium bg-[#0969da] text-white px-2.5 py-1 rounded hover:opacity-90"
            >
              Sign in
            </button>
          )}

          <EnvironmentSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Question Pane */}
        <div className="w-[40%] min-w-[300px] max-w-[600px] overflow-hidden">
          <QuestionPane question={question} />
        </div>

        {/* Divider */}
        <div className="w-px bg-[#d0d7de] dark:bg-[#30363d] flex-shrink-0" />

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

          {/* Persistent Bottom Drawer Bar (Console & Submissions Tabs) */}
          <div className="border-t border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] flex-shrink-0 flex flex-col">
            {/* Tab Toolbar */}
            <div className="h-10 px-4 flex items-center justify-between border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#0d1117]">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("console");
                    setIsDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    bottomTab === "console" && isDrawerOpen
                      ? "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d]"
                      : "text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d]"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-[#0969da] dark:text-[#58a6ff]" />
                  <span>Test results & console</span>
                  {currentSubmission?.status && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${verdictStyle.text}`}>
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
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    bottomTab === "submissions" && isDrawerOpen
                      ? "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d]"
                      : "text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d]"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-[#0969da] dark:text-[#58a6ff]" />
                  <span>Submissions</span>
                  <span className="text-[10px] bg-[#f6f8fa] dark:bg-[#21262d] text-[#656d76] dark:text-[#8d96a0] px-1.5 py-0.2 rounded border border-[#d0d7de] dark:border-[#30363d]">
                    {submissionsLoadedRef.current ? submissionsHistory.length : "•"}
                  </span>
                  {isSolved && (
                    <CheckCircle2 className="w-3 h-3 text-[#1a7f37] dark:text-[#3fb950]" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                title={isDrawerOpen ? "Collapse drawer" : "Expand drawer"}
                className="text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] p-1 rounded hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] transition-colors"
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
                className="bg-white dark:bg-[#0d1117] px-4 py-3 overflow-y-auto"
                style={{ height: "260px" }}
              >
                {/* 1. CONSOLE / TEST RESULTS TAB */}
                {bottomTab === "console" && (
                  <div>
                    {!currentSubmission ? (
                      <div className="py-10 text-center text-[#656d76] dark:text-[#8d96a0] text-xs">
                        Click &quot;Run code&quot; to test your solution with sample test cases or &quot;Submit solution&quot; for complete evaluation.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {/* Top Verdict & Summary Bar */}
                        <div className="flex items-center justify-between pb-2 mb-1 border-b border-[#d0d7de] dark:border-[#30363d]">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded border ${verdictStyle.border} ${verdictStyle.bg} ${verdictStyle.text}`}
                            >
                              {formatVerdict(currentSubmission.verdict || currentSubmission.status)}
                            </span>

                            {currentSubmission.executionTimeMs != null && (
                              <span className="text-xs text-[#656d76] dark:text-[#8d96a0] font-mono">
                                Runtime: {currentSubmission.executionTimeMs} ms
                              </span>
                            )}

                            {currentSubmission.tests && (
                              <span className="text-xs text-[#656d76] dark:text-[#8d96a0]">
                                Tests:{" "}
                                <span
                                  className={
                                    currentSubmission.tests.passed === currentSubmission.tests.total
                                      ? "text-[#1a7f37] dark:text-[#3fb950] font-medium"
                                      : "text-[#9a6700] dark:text-[#d29922] font-medium"
                                  }
                                >
                                  {currentSubmission.tests.passed}
                                </span>{" "}
                                of {currentSubmission.tests.total} passed
                              </span>
                            )}
                          </div>

                          {isRunning && (
                            <div className="flex items-center gap-1.5 text-xs text-[#0969da] dark:text-[#58a6ff] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0969da] dark:bg-[#58a6ff] animate-pulse" />
                              Evaluating solution in sandbox...
                            </div>
                          )}
                        </div>

                        {/* Compile Error Output */}
                        {currentSubmission.compileOutput && (
                          <div className="mb-2">
                            <div className="text-xs font-medium text-[#cf222e] dark:text-[#f85149] mb-1">
                              Compilation output:
                            </div>
                            <pre className="font-mono text-xs text-[#cf222e] dark:text-[#f85149] bg-[#cf222e]/5 dark:bg-[#f85149]/10 p-2.5 rounded border border-[#cf222e]/20 dark:border-[#f85149]/20 whitespace-pre-wrap max-h-36 overflow-y-auto">
                              {currentSubmission.compileOutput}
                            </pre>
                          </div>
                        )}

                        {/* System / Execution Error */}
                        {currentSubmission.errorMessage && (
                          <div className="mb-2">
                            <div className="text-xs font-medium text-[#cf222e] dark:text-[#f85149] mb-1">
                              Error message:
                            </div>
                            <pre className="font-mono text-xs text-[#cf222e] dark:text-[#f85149] bg-[#cf222e]/5 dark:bg-[#f85149]/10 p-2.5 rounded border border-[#cf222e]/20 dark:border-[#f85149]/20 whitespace-pre-wrap max-h-36 overflow-y-auto">
                              {currentSubmission.errorMessage}
                            </pre>
                          </div>
                        )}

                        {/* Individual Test Cases Viewer */}
                        {currentSubmission.testResults && currentSubmission.testResults.length > 0 && (
                          <div className="flex flex-col gap-2 mt-1">
                            {/* Test Case Tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-[#d0d7de] dark:border-[#30363d]">
                              {currentSubmission.testResults.map((tc, idx) => {
                                const isSelected = idx === selectedCaseIdx;
                                return (
                                  <button
                                    key={tc.id || idx}
                                    type="button"
                                    onClick={() => setSelectedCaseIdx(idx)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                      isSelected
                                        ? "bg-[#f6f8fa] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d]"
                                        : "text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] border border-transparent"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                        tc.passed
                                          ? "bg-[#1a7f37] dark:bg-[#3fb950]"
                                          : "bg-[#cf222e] dark:bg-[#f85149]"
                                      }`}
                                    />
                                    <span>Case {idx + 1}</span>
                                    <span
                                      className={`text-[10px] px-1 py-0.2 rounded ${
                                        tc.passed
                                          ? "text-[#1a7f37] dark:text-[#3fb950]"
                                          : "text-[#cf222e] dark:text-[#f85149]"
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
                                    <div className="text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0] mb-1">
                                      Input:
                                    </div>
                                    <pre className="bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] p-2.5 rounded text-xs font-mono text-[#1f2328] dark:text-[#f0f6fc] whitespace-pre-wrap">
                                      {activeCase.input != null ? activeCase.input : "(Hidden test case)"}
                                    </pre>
                                  </div>

                                  {/* Expected vs Actual Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <div className="text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0] mb-1">
                                        Expected output:
                                      </div>
                                      <pre className="bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] p-2.5 rounded text-xs font-mono text-[#1f2328] dark:text-[#f0f6fc] whitespace-pre-wrap">
                                        {activeCase.expectedOutput != null
                                          ? activeCase.expectedOutput
                                          : "(Hidden test case)"}
                                      </pre>
                                    </div>

                                    <div>
                                      <div className="text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0] mb-1 flex items-center justify-between">
                                        <span>Your output:</span>
                                        <span
                                          className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                            activeCase.passed
                                              ? "text-[#1a7f37] dark:text-[#3fb950] bg-[#1a7f37]/10"
                                              : "text-[#cf222e] dark:text-[#f85149] bg-[#cf222e]/10"
                                          }`}
                                        >
                                          {activeCase.passed ? "Match" : "Mismatch"}
                                        </span>
                                      </div>
                                      <pre
                                        className={`bg-[#f6f8fa] dark:bg-[#161b22] border p-2.5 rounded text-xs font-mono whitespace-pre-wrap ${
                                          activeCase.passed
                                            ? "border-[#1a7f37]/30 text-[#1a7f37] dark:text-[#3fb950]"
                                            : "border-[#cf222e]/30 text-[#cf222e] dark:text-[#f85149]"
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
                                      <div className="text-[11px] font-medium text-[#cf222e] dark:text-[#f85149] mb-1">
                                        Diagnostics / stderr:
                                      </div>
                                      <pre className="bg-[#cf222e]/5 dark:bg-[#f85149]/10 border border-[#cf222e]/20 dark:border-[#f85149]/20 text-[#cf222e] dark:text-[#f85149] p-2.5 rounded text-xs font-mono whitespace-pre-wrap">
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
                      <span className="text-xs font-medium text-[#1f2328] dark:text-[#f0f6fc]">
                        Past submissions ({sortedSubmissions.length})
                        {totalPages > 1 && (
                          <span className="ml-1.5 text-[#656d76] dark:text-[#8d96a0] font-normal">
                            · Page {validPage} of {totalPages}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => void loadSubmissions()}
                        disabled={loadingSubmissions}
                        className="text-xs text-[#0969da] dark:text-[#58a6ff] hover:underline font-medium disabled:opacity-50"
                      >
                        {loadingSubmissions ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    {loadingSubmissions && sortedSubmissions.length === 0 ? (
                      <div className="py-8 text-center text-[#656d76] dark:text-[#8d96a0] text-xs">
                        Loading submission history...
                      </div>
                    ) : sortedSubmissions.length === 0 ? (
                      <div className="py-8 text-center text-[#656d76] dark:text-[#8d96a0] text-xs">
                        No submissions yet. Submit your code to track results and save solution progress.
                      </div>
                    ) : (
                      <div className="border border-[#d0d7de] dark:border-[#30363d] rounded overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#f6f8fa] dark:bg-[#161b22] border-b border-[#d0d7de] dark:border-[#30363d] text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0]">
                            <tr>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Language</th>
                              <th className="px-3 py-2">Runtime</th>
                              <th className="px-3 py-2">Tests</th>
                              <th className="px-3 py-2">Submitted</th>
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#d0d7de] dark:divide-[#30363d]">
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
                                <tr key={sub.id} className="hover:bg-[#f6f8fa] dark:hover:bg-[#161b22]/60 transition-colors">
                                  <td className="px-3 py-2">
                                    <span
                                      className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-medium border ${vStyle.border} ${vStyle.bg} ${vStyle.text}`}
                                    >
                                      {sub.verdict === "ACCEPTED" && (
                                        <CheckCircle2 className="w-3 h-3 text-[#1a7f37] dark:text-[#3fb950]" />
                                      )}
                                      {formatVerdict(sub.verdict || sub.status)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[#1f2328] dark:text-[#f0f6fc]">
                                    {sub.language}
                                  </td>
                                  <td className="px-3 py-2 text-[#656d76] dark:text-[#8d96a0] font-mono">
                                    {sub.executionTimeMs != null ? `${sub.executionTimeMs} ms` : "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#656d76] dark:text-[#8d96a0] font-mono">
                                    {sub.tests
                                      ? `${sub.tests.passed} / ${sub.tests.total}`
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2 text-[#656d76] dark:text-[#8d96a0] text-[11px]">
                                    {dateStr}
                                  </td>
                                  <td className="px-3 py-2 text-right space-x-1.5">
                                    <button
                                      type="button"
                                      disabled={loadingDetailsSubId === sub.id}
                                      onClick={() => void handleViewSubmission(sub.id)}
                                      className="px-2 py-0.5 rounded bg-[#f6f8fa] dark:bg-[#21262d] hover:bg-[#e4e7eb] dark:hover:bg-[#30363d] text-[#1f2328] dark:text-[#f0f6fc] text-[11px] font-medium border border-[#d0d7de] dark:border-[#30363d] transition-colors disabled:opacity-50"
                                    >
                                      {loadingDetailsSubId === sub.id ? "Loading..." : "View details"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={loadingDetailsSubId === sub.id}
                                      onClick={() => void handleRestoreSubmission(sub)}
                                      className="px-2 py-0.5 rounded text-[#0969da] dark:text-[#58a6ff] hover:bg-[#0969da]/10 dark:hover:bg-[#58a6ff]/10 text-[11px] font-medium border border-[#0969da]/30 dark:border-[#58a6ff]/30 transition-colors disabled:opacity-50"
                                    >
                                      Restore
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Pagination Bar (10 submissions per page) */}
                        {totalPages > 1 && (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] text-xs">
                            <div className="text-[#656d76] dark:text-[#8d96a0]">
                              Showing{" "}
                              <span className="font-medium text-[#1f2328] dark:text-[#f0f6fc]">
                                {startIndex + 1}
                              </span>
                              –
                              <span className="font-medium text-[#1f2328] dark:text-[#f0f6fc]">
                                {Math.min(startIndex + SUBMISSIONS_PER_PAGE, sortedSubmissions.length)}
                              </span>{" "}
                              of{" "}
                              <span className="font-medium text-[#1f2328] dark:text-[#f0f6fc]">
                                {sortedSubmissions.length}
                              </span>{" "}
                              submissions
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={validPage === 1}
                                onClick={() => setSubmissionsPage((p) => Math.max(1, p - 1))}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f6f8fa] dark:hover:bg-[#30363d] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Prev</span>
                              </button>

                              <div className="flex items-center gap-0.5">
                                {pageNumbers.map((p, idx) =>
                                  typeof p === "number" ? (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setSubmissionsPage(p)}
                                      className={`min-w-[28px] h-7 px-1.5 rounded text-xs font-medium border transition-colors ${
                                        p === validPage
                                          ? "bg-[#0969da] text-white border-[#0969da]"
                                          : "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border-[#d0d7de] dark:border-[#30363d] hover:bg-[#f6f8fa] dark:hover:bg-[#30363d]"
                                      }`}
                                    >
                                      {p}
                                    </button>
                                  ) : (
                                    <span key={`ellipsis-${idx}`} className="px-1 text-[#656d76] dark:text-[#8d96a0]">
                                      ...
                                    </span>
                                  )
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={validPage === totalPages}
                                onClick={() => setSubmissionsPage((p) => Math.min(totalPages, p + 1))}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] hover:bg-[#f6f8fa] dark:hover:bg-[#30363d] disabled:opacity-40 disabled:pointer-events-none transition-colors"
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
            )}
          </div>
        </div>
      </div>

      {/* Submission Details Modal with Test Results & Code */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-lg w-full max-w-3xl flex flex-col max-h-[90vh] shadow-xl overflow-hidden text-[#1f2328] dark:text-[#f0f6fc]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#0d1117]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#0969da] dark:text-[#58a6ff]" />
                <span className="text-xs font-semibold text-[#1f2328] dark:text-[#f0f6fc]">
                  Submission details ({viewingSubmission.language})
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
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
                className="text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-3 gap-3 px-4 py-2.5 bg-[#f6f8fa] dark:bg-[#0d1117] border-b border-[#d0d7de] dark:border-[#30363d] text-xs">
              <div>
                <span className="text-[#656d76] dark:text-[#8d96a0] block text-[10px]">Runtime</span>
                <span className="font-mono text-[#1f2328] dark:text-[#f0f6fc] font-medium">
                  {viewingSubmission.executionTimeMs != null
                    ? `${viewingSubmission.executionTimeMs} ms`
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-[#656d76] dark:text-[#8d96a0] block text-[10px]">Tests passed</span>
                <span className="font-mono text-[#1f2328] dark:text-[#f0f6fc] font-medium">
                  {viewingSubmission.tests
                    ? `${viewingSubmission.tests.passed} / ${viewingSubmission.tests.total}`
                    : "-"}
                </span>
              </div>
              <div>
                <span className="text-[#656d76] dark:text-[#8d96a0] block text-[10px]">Submitted at</span>
                <span className="text-[#1f2328] dark:text-[#f0f6fc] text-[11px]">
                  {viewingSubmission.createdAt
                    ? new Date(viewingSubmission.createdAt).toLocaleString()
                    : "-"}
                </span>
              </div>
            </div>

            {/* Modal Navigation Tabs: Test Results vs Code */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22]">
              <button
                type="button"
                onClick={() => setDialogTab("cases")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  dialogTab === "cases"
                    ? "bg-[#0969da] text-white shadow-xs"
                    : "text-[#656d76] dark:text-[#8d96a0] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d]"
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
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  dialogTab === "code"
                    ? "bg-[#0969da] text-white shadow-xs"
                    : "text-[#656d76] dark:text-[#8d96a0] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Submitted code</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {dialogTab === "cases" ? (
                <div>
                  {/* Compile Output */}
                  {viewingSubmission.compileOutput && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-[#cf222e] dark:text-[#f85149] mb-1">
                        Compilation output:
                      </div>
                      <pre className="font-mono text-xs text-[#cf222e] dark:text-[#f85149] bg-[#cf222e]/5 dark:bg-[#f85149]/10 p-2.5 rounded border border-[#cf222e]/20 dark:border-[#f85149]/20 whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {viewingSubmission.compileOutput}
                      </pre>
                    </div>
                  )}

                  {/* Error Message */}
                  {viewingSubmission.errorMessage && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-[#cf222e] dark:text-[#f85149] mb-1">
                        Error message:
                      </div>
                      <pre className="font-mono text-xs text-[#cf222e] dark:text-[#f85149] bg-[#cf222e]/5 dark:bg-[#f85149]/10 p-2.5 rounded border border-[#cf222e]/20 dark:border-[#f85149]/20 whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {viewingSubmission.errorMessage}
                      </pre>
                    </div>
                  )}

                  {/* Test Cases Results with Data */}
                  {viewingSubmission.testResults && viewingSubmission.testResults.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {/* Case selector chips */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-[#d0d7de] dark:border-[#30363d]">
                        {viewingSubmission.testResults.map((tc, idx) => {
                          const isSelected = idx === dialogCaseIdx;
                          return (
                            <button
                              key={tc.id || idx}
                              type="button"
                              onClick={() => setDialogCaseIdx(idx)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                isSelected
                                  ? "bg-[#f6f8fa] dark:bg-[#21262d] text-[#1f2328] dark:text-[#f0f6fc] border border-[#d0d7de] dark:border-[#30363d]"
                                  : "text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc] border border-transparent"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  tc.passed
                                    ? "bg-[#1a7f37] dark:bg-[#3fb950]"
                                    : "bg-[#cf222e] dark:bg-[#f85149]"
                                }`}
                              />
                              <span>Case {idx + 1}</span>
                              <span
                                className={`text-[10px] px-1 py-0.2 rounded ${
                                  tc.passed
                                    ? "text-[#1a7f37] dark:text-[#3fb950]"
                                    : "text-[#cf222e] dark:text-[#f85149]"
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
                              <div className="text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0] mb-1">
                                Input:
                              </div>
                              <pre className="bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] p-2.5 rounded text-xs font-mono text-[#1f2328] dark:text-[#f0f6fc] whitespace-pre-wrap max-h-36 overflow-y-auto">
                                {activeCase.input != null ? activeCase.input : "(Hidden test case input)"}
                              </pre>
                            </div>

                            {/* Expected vs Actual Output */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <div className="text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0] mb-1">
                                  Expected output:
                                </div>
                                <pre className="bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] p-2.5 rounded text-xs font-mono text-[#1f2328] dark:text-[#f0f6fc] whitespace-pre-wrap max-h-36 overflow-y-auto">
                                  {activeCase.expectedOutput != null
                                    ? activeCase.expectedOutput
                                    : "(Hidden test case expected output)"}
                                </pre>
                              </div>

                              <div>
                                <div className="text-[11px] font-medium text-[#656d76] dark:text-[#8d96a0] mb-1 flex items-center justify-between">
                                  <span>Your output:</span>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                      activeCase.passed
                                        ? "text-[#1a7f37] dark:text-[#3fb950] bg-[#1a7f37]/10"
                                        : "text-[#cf222e] dark:text-[#f85149] bg-[#cf222e]/10"
                                    }`}
                                  >
                                    {activeCase.passed ? "Match" : "Mismatch"}
                                  </span>
                                </div>
                                <pre
                                  className={`bg-[#f6f8fa] dark:bg-[#0d1117] border p-2.5 rounded text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto ${
                                    activeCase.passed
                                      ? "border-[#1a7f37]/30 text-[#1a7f37] dark:text-[#3fb950]"
                                      : "border-[#cf222e]/30 text-[#cf222e] dark:text-[#f85149]"
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
                                <div className="text-[11px] font-medium text-[#cf222e] dark:text-[#f85149] mb-1">
                                  Diagnostics / stderr:
                                </div>
                                <pre className="bg-[#cf222e]/5 dark:bg-[#f85149]/10 border border-[#cf222e]/20 dark:border-[#f85149]/20 text-[#cf222e] dark:text-[#f85149] p-2.5 rounded text-xs font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                                  {activeCase.error}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-[#656d76] dark:text-[#8d96a0]">
                      No individual test case results recorded for this submission.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[#656d76] dark:text-[#8d96a0]">
                      Submitted code ({viewingSubmission.language}):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCodeToClipboard(viewingSubmission.sourceCode)}
                      className="flex items-center gap-1 text-[11px] text-[#656d76] dark:text-[#8d96a0] hover:text-[#1f2328] dark:hover:text-[#f0f6fc]"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#1a7f37] dark:text-[#3fb950]" />
                          <span className="text-[#1a7f37] dark:text-[#3fb950]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-[#f6f8fa] dark:bg-[#0d1117] border border-[#d0d7de] dark:border-[#30363d] p-3 rounded text-xs font-mono text-[#1f2328] dark:text-[#f0f6fc] whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {viewingSubmission.sourceCode}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#0d1117]">
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="px-3 py-1.5 rounded bg-[#f6f8fa] dark:bg-[#21262d] hover:bg-[#e4e7eb] dark:hover:bg-[#30363d] text-[#1f2328] dark:text-[#f0f6fc] text-xs font-medium border border-[#d0d7de] dark:border-[#30363d]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => restoreSubmissionToEditor(viewingSubmission)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0969da] hover:bg-[#0854b0] text-white text-xs font-medium shadow-xs"
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
