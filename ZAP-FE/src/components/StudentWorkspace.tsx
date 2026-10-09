"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
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
} from "lucide-react";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { QuestionPane, QuestionData } from "./QuestionPane";
import { EditorPane } from "./EditorPane";
import { getStoredStudent, AUTH_CHANGE_EVENT, authApi } from "@/services/authApi";
import { AuthModal } from "@/components/AuthModal";
import type { Student } from "@/types/auth";
import {
  submissionsApi,
  Submission,
  isTerminalStatus,
  SubmissionMode,
} from "@/services/submissionsApi";

interface StudentWorkspaceProps {
  question: QuestionData;
  onBackToCatalog?: () => void;
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
  ACCEPTED: { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-700/50" },
  WRONG_ANSWER: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-700/50" },
  COMPILE_ERROR: { bg: "bg-orange-950/60", text: "text-orange-400", border: "border-orange-700/50" },
  RUNTIME_ERROR: { bg: "bg-red-950/60", text: "text-red-400", border: "border-red-700/50" },
  TIME_LIMIT_EXCEEDED: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-700/50" },
  MEMORY_LIMIT_EXCEEDED: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-700/50" },
  OUTPUT_LIMIT_EXCEEDED: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-700/50" },
  SYSTEM_ERROR: { bg: "bg-rose-950/80", text: "text-rose-400", border: "border-rose-700/60" },
  QUEUED: { bg: "bg-sky-950/60", text: "text-sky-400", border: "border-sky-700/50" },
  RUNNING: { bg: "bg-sky-950/60", text: "text-sky-400", border: "border-sky-700/50" },
  FAILED: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-700/50" },
  IDLE: { bg: "bg-slate-900/40", text: "text-slate-400", border: "border-slate-700/30" },
};

function cleanStarter(codeStr?: string): string {
  if (!codeStr) return "";
  return codeStr.replace(/^\s*pass\s*$/gm, "");
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({ question, onBackToCatalog }) => {
  const [student, setStudent] = useState<Student | null>(() => getStoredStudent());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(() => cleanStarter(question.starterCode?.["python"] || DEFAULT_CODE["python"]));
  const [currentSubmission, setCurrentSubmission] = useState<Partial<Submission> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [restoredNotice, setRestoredNotice] = useState<string | null>(null);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

  // Submissions drawer tabs & history state
  const [submissionsHistory, setSubmissionsHistory] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [bottomTab, setBottomTab] = useState<"console" | "submissions">("console");
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // In-session drafts per language
  const draftsRef = useRef<Record<string, string>>({});
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleAuthChange = () => setStudent(getStoredStudent());
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
  }, []);

  const cleanupPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupPolling();
  }, [cleanupPolling]);

  const getStarterCode = useCallback(
    (lang: string) => {
      const raw = question.starterCode?.[lang] || DEFAULT_CODE[lang] || "";
      return lang === "python" ? cleanStarter(raw) : raw;
    },
    [question.starterCode]
  );

  // Fetch past submissions for this problem by this student
  const loadSubmissions = useCallback(async () => {
    if (!student) return;
    setLoadingSubmissions(true);
    try {
      const list = await submissionsApi.list({
        questionId: question.id,
        userId: student.studentId,
        mode: "SUBMIT",
        limit: 50,
      });
      setSubmissionsHistory(list || []);
    } catch (err) {
      console.error("Failed to load submissions history", err);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [question.id, student]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  // When question changes, reset drafts and load
  useEffect(() => {
    draftsRef.current = {};
    setCurrentSubmission(null);
    setErrorNotice(null);
    setSelectedCaseIdx(0);
    setCode(getStarterCode(language));
  }, [question.id, getStarterCode, language]);

  // If submissions history finishes loading and user has not typed any custom draft for current language,
  // restore their latest submitted code!
  useEffect(() => {
    if (submissionsHistory.length > 0 && !draftsRef.current[language]) {
      const latestForLang = submissionsHistory.find(
        (s) => s.language === language && s.sourceCode
      );
      if (latestForLang && latestForLang.sourceCode) {
        setCode(latestForLang.sourceCode);
      }
    }
  }, [submissionsHistory, language]);

  const handleLanguageChange = useCallback(
    (newLang: string) => {
      draftsRef.current[language] = code;
      setLanguage(newLang);
      setCurrentSubmission(null);
      setErrorNotice(null);
      setSelectedCaseIdx(0);

      // 1. If user typed in this session for newLang, restore that draft
      if (draftsRef.current[newLang]) {
        setCode(draftsRef.current[newLang]);
        return;
      }

      // 2. If user previously submitted code for this language, restore latest submission
      const prevSub = submissionsHistory.find((s) => s.language === newLang && s.sourceCode);
      if (prevSub) {
        setCode(prevSub.sourceCode);
        setRestoredNotice(`Restored latest submitted ${newLang.toUpperCase()} code`);
        setTimeout(() => setRestoredNotice(null), 3000);
        return;
      }

      // 3. Fallback to starter code
      setCode(getStarterCode(newLang));
    },
    [code, language, submissionsHistory, getStarterCode]
  );

  const handleCodeChange = useCallback(
    (newCode: string) => {
      draftsRef.current[language] = newCode;
      setCode(newCode);
    },
    [language]
  );

  const restoreSubmissionToEditor = useCallback(
    (sub: Submission) => {
      setCode(sub.sourceCode);
      if (sub.language !== language) {
        setLanguage(sub.language);
      }
      draftsRef.current[sub.language] = sub.sourceCode;
      setRestoredNotice(`Loaded submission (${sub.language.toUpperCase()}) into editor`);
      setTimeout(() => setRestoredNotice(null), 3500);
      setViewingSubmission(null);
    },
    [language]
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

      try {
        const createRes = await submissionsApi.create({
          questionId: question.id,
          language,
          mode,
          sourceCode: code,
          userId: student ? student.studentId : "student-123",
        });

        const subId = createRes.submissionId;
        setCurrentSubmission({ id: subId, status: createRes.status, mode });

        // Poll for updates every 1 second (1000ms)
        let pollCount = 0;
        const MAX_POLLS = 60; // 60 seconds safety guard
        pollIntervalRef.current = setInterval(async () => {
          pollCount += 1;
          if (pollCount > MAX_POLLS) {
            cleanupPolling();
            setIsRunning(false);
            setErrorNotice("Execution timed out. Please try running again.");
            return;
          }

          try {
            const sub = await submissionsApi.get(subId);
            setCurrentSubmission(sub);

            if (isTerminalStatus(sub.status)) {
              cleanupPolling();
              setIsRunning(false);
              if (sub.testResults && sub.testResults.length > 0) {
                const firstFail = sub.testResults.findIndex((tc) => !tc.passed);
                setSelectedCaseIdx(firstFail >= 0 ? firstFail : 0);
              }

              // When a SUBMIT finishes, reload submissions list to update history & solved status
              if (mode === "SUBMIT") {
                void loadSubmissions();
              }
            }
          } catch (pollErr: unknown) {
            const message = pollErr instanceof Error ? pollErr.message : "Unknown polling error.";
            cleanupPolling();
            setIsRunning(false);
            setCurrentSubmission((submission) =>
              submission
                ? {
                    ...submission,
                    errorMessage: `Status unavailable for submission ${subId}: ${message}`,
                  }
                : submission
            );
            setErrorNotice(`Failed to fetch status for submission ${subId}: ${message}`);
          }
        }, 1000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown submission error.";
        setErrorNotice(`Submission failed: ${message}`);
        setCurrentSubmission((submission) => ({
          ...(submission ?? {}),
          status: "FAILED",
          errorMessage: message,
        }));
        setIsRunning(false);
      }
    },
    [isRunning, cleanupPolling, student, question.id, language, code, loadSubmissions]
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950">
      {/* Top Header Bar */}
      <header className="h-11 border-b border-slate-800/80 bg-slate-900/95 flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          {onBackToCatalog ? (
            <button
              onClick={onBackToCatalog}
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded transition-colors"
            >
              ← Problems
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded transition-colors"
            >
              ← Problems
            </Link>
          )}
          <span className="text-sky-400 font-black text-lg tracking-tight select-none">ZAP</span>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-slate-200 text-xs font-medium truncate max-w-sm">{question.title}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
              question.difficulty === "HARD"
                ? "text-rose-400 border-rose-800/60 bg-rose-950/40"
                : question.difficulty === "MEDIUM"
                ? "text-amber-400 border-amber-800/60 bg-amber-950/40"
                : "text-emerald-400 border-emerald-800/60 bg-emerald-950/40"
            }`}
          >
            {question.difficulty}
          </span>

          {isSolved && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-600/40 bg-emerald-950/60 text-emerald-400">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Solved
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {restoredNotice && (
            <span className="text-emerald-400 text-xs truncate bg-emerald-950/50 border border-emerald-800/50 px-2 py-0.5 rounded flex items-center gap-1">
              <Check className="w-3 h-3" />
              {restoredNotice}
            </span>
          )}

          {errorNotice && (
            <span className="text-amber-400 text-xs truncate bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">
              {errorNotice}
            </span>
          )}

          {student ? (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs">
              <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[10px]">
                {student.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-semibold text-slate-200 text-[11px] leading-tight">
                  {student.name}
                </span>
                <span className="text-[9px] text-slate-400 leading-tight">
                  {student.studentId} · {student.collegeName}
                </span>
              </div>
              <button
                onClick={() => {
                  authApi.logout();
                  if (onBackToCatalog) onBackToCatalog();
                }}
                title="Sign Out"
                type="button"
                className="ml-1 text-slate-400 hover:text-rose-400 p-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              type="button"
              className="text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-lg shadow-sm transition-colors"
            >
              Sign In
            </button>
          )}

          <EnvironmentSwitcher />
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Question Pane */}
        <div className="w-[40%] min-w-[300px] max-w-[600px] overflow-hidden">
          <QuestionPane question={question} />
        </div>

        {/* Divider */}
        <div className="w-px bg-slate-800 flex-shrink-0" />

        {/* Right Editor + Output & Submissions Drawer */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <EditorPane
              language={language}
              onLanguageChange={handleLanguageChange}
              code={code}
              onCodeChange={handleCodeChange}
              onRun={handleRun}
              onSubmit={handleSubmit}
              isRunning={isRunning}
              statusText={statusLabel}
            />
          </div>

          {/* Persistent Bottom Drawer Bar (Console & Submissions Tabs) */}
          <div className="border-t border-slate-800 bg-slate-900/95 flex-shrink-0 flex flex-col">
            {/* Tab Toolbar */}
            <div className="h-10 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("console");
                    setIsDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                    bottomTab === "console" && isDrawerOpen
                      ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span>Test Results & Console</span>
                  {currentSubmission?.status && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${verdictStyle.text}`}
                    >
                      ({currentSubmission.verdict || currentSubmission.status})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBottomTab("submissions");
                    setIsDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all ${
                    bottomTab === "submissions" && isDrawerOpen
                      ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Submissions</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded-full border border-slate-700">
                    {submissionsHistory.length}
                  </span>
                  {isSolved && (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen((prev) => !prev)}
                title={isDrawerOpen ? "Collapse Drawer" : "Expand Drawer"}
                className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
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
                className="bg-slate-950/95 px-5 py-3 overflow-y-auto"
                style={{ height: "260px" }}
              >
                {/* 1. CONSOLE / TEST RESULTS TAB */}
                {bottomTab === "console" && (
                  <div>
                    {!currentSubmission ? (
                      <div className="py-10 text-center text-slate-500 text-xs">
                        Click &quot;Run Code&quot; to test your solution with sample test cases or &quot;Submit&quot; for complete evaluation.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {/* Top Verdict & Summary Bar */}
                        <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800/80">
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${verdictStyle.border} ${verdictStyle.bg} ${verdictStyle.text}`}
                            >
                              {currentSubmission.verdict || currentSubmission.status}
                            </span>

                            {currentSubmission.executionTimeMs != null && (
                              <span className="text-xs text-slate-400 font-mono">
                                ⏱ {currentSubmission.executionTimeMs} ms
                              </span>
                            )}

                            {currentSubmission.tests && (
                              <span className="text-xs text-slate-300 font-medium">
                                Tests:{" "}
                                <span
                                  className={
                                    currentSubmission.tests.passed === currentSubmission.tests.total
                                      ? "text-emerald-400"
                                      : "text-amber-400"
                                  }
                                >
                                  {currentSubmission.tests.passed}
                                </span>{" "}
                                / {currentSubmission.tests.total} passed
                              </span>
                            )}
                          </div>

                          {isRunning && (
                            <div className="flex items-center gap-1.5 text-xs text-sky-400 animate-pulse font-medium">
                              <span className="w-2 h-2 rounded-full bg-sky-400" />
                              Evaluating solution in sandbox...
                            </div>
                          )}
                        </div>

                        {/* Compile Error Output */}
                        {currentSubmission.compileOutput && (
                          <div className="mb-2">
                            <div className="text-xs font-semibold text-orange-400 mb-1">
                              Compilation Output:
                            </div>
                            <pre className="font-mono text-xs text-orange-300 bg-orange-950/40 p-2.5 rounded border border-orange-800/50 whitespace-pre-wrap max-h-36 overflow-y-auto">
                              {currentSubmission.compileOutput}
                            </pre>
                          </div>
                        )}

                        {/* System / Execution Error */}
                        {currentSubmission.errorMessage && (
                          <div className="mb-2">
                            <div className="text-xs font-semibold text-rose-400 mb-1">
                              Error Message:
                            </div>
                            <pre className="font-mono text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded border border-rose-800/50 whitespace-pre-wrap max-h-36 overflow-y-auto">
                              {currentSubmission.errorMessage}
                            </pre>
                          </div>
                        )}

                        {/* Individual Test Cases Viewer */}
                        {currentSubmission.testResults && currentSubmission.testResults.length > 0 && (
                          <div className="flex flex-col gap-2 mt-1">
                            {/* Test Case Tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/60">
                              {currentSubmission.testResults.map((tc, idx) => {
                                const isSelected = idx === selectedCaseIdx;
                                return (
                                  <button
                                    key={tc.id || idx}
                                    type="button"
                                    onClick={() => setSelectedCaseIdx(idx)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all ${
                                      isSelected
                                        ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                                    }`}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        tc.passed ? "bg-emerald-400" : "bg-rose-500"
                                      }`}
                                    />
                                    <span>Case {idx + 1}</span>
                                    <span
                                      className={`text-[10px] uppercase font-bold ${
                                        tc.passed ? "text-emerald-400" : "text-rose-400"
                                      }`}
                                    >
                                      ({tc.status})
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
                                    <div className="text-[11px] font-semibold text-slate-400 mb-1">
                                      Input:
                                    </div>
                                    <pre className="bg-slate-900 border border-slate-800 p-2 rounded text-xs font-mono text-slate-200 whitespace-pre-wrap">
                                      {activeCase.input != null ? activeCase.input : "(Hidden Test Case)"}
                                    </pre>
                                  </div>

                                  {/* Expected vs Actual Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <div className="text-[11px] font-semibold text-slate-400 mb-1">
                                        Expected Output:
                                      </div>
                                      <pre className="bg-slate-900 border border-slate-800 p-2 rounded text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                                        {activeCase.expectedOutput != null
                                          ? activeCase.expectedOutput
                                          : "(Hidden Test Case)"}
                                      </pre>
                                    </div>

                                    <div>
                                      <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                                        <span>Your Output:</span>
                                        <span
                                          className={`text-[10px] font-bold ${
                                            activeCase.passed ? "text-emerald-400" : "text-rose-400"
                                          }`}
                                        >
                                          {activeCase.passed ? "MATCH" : "DIFF"}
                                        </span>
                                      </div>
                                      <pre
                                        className={`bg-slate-900 border p-2 rounded text-xs font-mono whitespace-pre-wrap ${
                                          activeCase.passed
                                            ? "border-emerald-800/40 text-emerald-300"
                                            : "border-rose-800/40 text-rose-300"
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
                                      <div className="text-[11px] font-semibold text-rose-400 mb-1">
                                        Diagnostics / Stderr:
                                      </div>
                                      <pre className="bg-rose-950/30 border border-rose-800/40 text-rose-300 p-2 rounded text-xs font-mono whitespace-pre-wrap">
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
                      <span className="text-xs font-semibold text-slate-300">
                        Past Submissions ({submissionsHistory.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => void loadSubmissions()}
                        disabled={loadingSubmissions}
                        className="text-xs text-sky-400 hover:text-sky-300 font-medium disabled:opacity-50"
                      >
                        {loadingSubmissions ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>

                    {loadingSubmissions && submissionsHistory.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        Loading submission history...
                      </div>
                    ) : submissionsHistory.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs">
                        No submissions yet. Submit your code to see results and track your progress.
                      </div>
                    ) : (
                      <div className="border border-slate-800 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            <tr>
                              <th className="px-3 py-2">Status</th>
                              <th className="px-3 py-2">Language</th>
                              <th className="px-3 py-2">Runtime</th>
                              <th className="px-3 py-2">Tests</th>
                              <th className="px-3 py-2">Submitted</th>
                              <th className="px-3 py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {submissionsHistory.map((sub) => {
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
                                <tr key={sub.id} className="hover:bg-slate-900/60 transition-colors">
                                  <td className="px-3 py-2.5">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${vStyle.border} ${vStyle.bg} ${vStyle.text}`}
                                    >
                                      {sub.verdict === "ACCEPTED" && (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      )}
                                      {sub.verdict || sub.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-slate-300 uppercase">
                                    {sub.language}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-400 font-mono">
                                    {sub.executionTimeMs != null ? `${sub.executionTimeMs} ms` : "-"}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-300 font-mono">
                                    {sub.tests
                                      ? `${sub.tests.passed} / ${sub.tests.total}`
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-400 text-[11px]">
                                    {dateStr}
                                  </td>
                                  <td className="px-3 py-2.5 text-right space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setViewingSubmission(sub)}
                                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-colors"
                                    >
                                      View Code
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => restoreSubmissionToEditor(sub)}
                                      className="px-2 py-1 rounded bg-sky-600/30 hover:bg-sky-600/50 text-sky-300 text-[11px] font-medium border border-sky-500/40 transition-colors"
                                    >
                                      Restore
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submission Code Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2.5">
                <Code2 className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200">
                  Submission Details · {viewingSubmission.language.toUpperCase()}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    VERDICT_STYLES[viewingSubmission.verdict || "IDLE"]?.text
                  } ${VERDICT_STYLES[viewingSubmission.verdict || "IDLE"]?.bg} ${
                    VERDICT_STYLES[viewingSubmission.verdict || "IDLE"]?.border
                  }`}
                >
                  {viewingSubmission.verdict || viewingSubmission.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Runtime</span>
                  <span className="font-mono text-slate-300">
                    {viewingSubmission.executionTimeMs != null
                      ? `${viewingSubmission.executionTimeMs} ms`
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Tests Passed</span>
                  <span className="font-mono text-slate-300">
                    {viewingSubmission.tests
                      ? `${viewingSubmission.tests.passed} / ${viewingSubmission.tests.total}`
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Submitted At</span>
                  <span className="text-slate-300 text-[11px]">
                    {viewingSubmission.createdAt
                      ? new Date(viewingSubmission.createdAt).toLocaleString()
                      : "-"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-400">Submitted Code:</span>
                  <button
                    type="button"
                    onClick={() => copyCodeToClipboard(viewingSubmission.sourceCode)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {viewingSubmission.sourceCode}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800 bg-slate-950">
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => restoreSubmissionToEditor(viewingSubmission)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore into Editor
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
