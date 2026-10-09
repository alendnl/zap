"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { QuestionPane, QuestionData } from "./QuestionPane";
import { EditorPane } from "./EditorPane";
import { questionsApi } from "@/services/questionsApi";
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
  python: `class Solution:
    def solution(self):
        # Write your solution here
        pass
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

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({ question, onBackToCatalog }) => {
  const [student, setStudent] = useState<Student | null>(() => getStoredStudent());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(question.starterCode?.["python"] || DEFAULT_CODE["python"]);
  const [currentSubmission, setCurrentSubmission] = useState<Partial<Submission> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

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

  useEffect(() => {
    setCode(question.starterCode?.[language] || DEFAULT_CODE[language] || "");
    setCurrentSubmission(null);
    setErrorNotice(null);
    setSelectedCaseIdx(0);
  }, [question.id, question.starterCode, language]);

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
    setCode(question.starterCode?.[lang] || DEFAULT_CODE[lang] || "");
    setCurrentSubmission(null);
    setErrorNotice(null);
    setSelectedCaseIdx(0);
  }, [question.starterCode]);


  const triggerExecution = useCallback(
    async (mode: SubmissionMode) => {
      if (isRunning) return;
      cleanupPolling();
      setIsRunning(true);
      setErrorNotice(null);
      setSelectedCaseIdx(0);
      setCurrentSubmission({ status: "QUEUED" });

      try {
        const createRes = await submissionsApi.create({
          questionId: question.id,
          language,
          mode,
          sourceCode: code,
          userId: student ? student.studentId : "student-123",
        });

        const subId = createRes.submissionId;
        setCurrentSubmission({ id: subId, status: createRes.status });

        // Poll for updates
        pollIntervalRef.current = setInterval(async () => {
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
            }
          } catch (pollErr: unknown) {
            const message = pollErr instanceof Error ? pollErr.message : "Unknown polling error.";
            cleanupPolling();
            setIsRunning(false);
            setCurrentSubmission((submission) => submission ? ({
              ...submission,
              errorMessage: `Status unavailable for submission ${subId}: ${message}`,
            }) : submission);
            setErrorNotice(`Failed to fetch status for submission ${subId}: ${message}`);
          }
        }, 600);
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
    [isRunning, cleanupPolling, question.id, question.slug, language, code]
  );

  const handleRun = useCallback(() => triggerExecution("RUN"), [triggerExecution]);
  const handleSubmit = useCallback(() => triggerExecution("SUBMIT"), [triggerExecution]);

  const statusKey =
    currentSubmission?.verdict || currentSubmission?.status || "IDLE";
  const verdictStyle = VERDICT_STYLES[statusKey] || VERDICT_STYLES["IDLE"];
  const statusLabel = currentSubmission?.status;

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
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
            question.difficulty === "HARD"
              ? "text-rose-400 border-rose-800/60 bg-rose-950/40"
              : question.difficulty === "MEDIUM"
              ? "text-amber-400 border-amber-800/60 bg-amber-950/40"
              : "text-emerald-400 border-emerald-800/60 bg-emerald-950/40"
          }`}>
            {question.difficulty}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
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
                onClick={() => authApi.logout()}
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

        {/* Right Editor + Output Console */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <EditorPane
              language={language}
              onLanguageChange={handleLanguageChange}
              code={code}
              onCodeChange={setCode}
              onRun={handleRun}
              onSubmit={handleSubmit}
              isRunning={isRunning}
              statusText={statusLabel}
            />
          </div>

          {/* Submission Result / Console Output Drawer */}
          {currentSubmission && currentSubmission.status && (
            <div
              className={`border-t ${verdictStyle.border} bg-slate-950/95 px-5 py-3 transition-all flex-shrink-0 flex flex-col`}
              style={{ minHeight: "180px", maxHeight: "360px", overflowY: "auto" }}
            >
              {/* Top Verdict & Summary Bar */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${verdictStyle.border} ${verdictStyle.bg} ${verdictStyle.text}`}>
                    {currentSubmission.verdict || currentSubmission.status}
                  </span>

                  {currentSubmission.executionTimeMs != null && (
                    <span className="text-xs text-slate-400 font-mono">
                      ⏱ {currentSubmission.executionTimeMs} ms
                    </span>
                  )}

                  {currentSubmission.tests && (
                    <span className="text-xs text-slate-300 font-medium">
                      Tests: <span className={currentSubmission.tests.passed === currentSubmission.tests.total ? "text-emerald-400" : "text-amber-400"}>{currentSubmission.tests.passed}</span> / {currentSubmission.tests.total} passed
                    </span>
                  )}
                </div>

                {isRunning && (
                  <div className="flex items-center gap-1.5 text-xs text-sky-400 animate-pulse font-medium">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    Executing in sandbox...
                  </div>
                )}
              </div>

              {/* Compile Error Output */}
              {currentSubmission.compileOutput && (
                <div className="mb-2">
                  <div className="text-xs font-semibold text-orange-400 mb-1">Compilation Output:</div>
                  <pre className="font-mono text-xs text-orange-300 bg-orange-950/40 p-2.5 rounded border border-orange-800/50 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {currentSubmission.compileOutput}
                  </pre>
                </div>
              )}

              {/* System / Execution Error */}
              {currentSubmission.errorMessage && (
                <div className="mb-2">
                  <div className="text-xs font-semibold text-rose-400 mb-1">Error Message:</div>
                  <pre className="font-mono text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded border border-rose-800/50 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {currentSubmission.errorMessage}
                  </pre>
                </div>
              )}

              {/* Individual Test Cases Viewer */}
              {currentSubmission.testResults && currentSubmission.testResults.length > 0 && (
                <div className="flex-1 flex flex-col gap-2 mt-1">
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
                          <span className={`text-[10px] uppercase font-bold ${tc.passed ? "text-emerald-400" : "text-rose-400"}`}>
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
                          <div className="text-[11px] font-semibold text-slate-400 mb-1">Input:</div>
                          <pre className="bg-slate-900 border border-slate-800 p-2 rounded text-xs font-mono text-slate-200 whitespace-pre-wrap">
                            {activeCase.input != null ? activeCase.input : "(Hidden Test Case)"}
                          </pre>
                        </div>

                        {/* Expected Output vs Actual Output Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Expected Output */}
                          <div>
                            <div className="text-[11px] font-semibold text-slate-400 mb-1">Expected Output:</div>
                            <pre className="bg-slate-900 border border-slate-800 p-2 rounded text-xs font-mono text-emerald-400 whitespace-pre-wrap">
                              {activeCase.expectedOutput != null ? activeCase.expectedOutput : "(Hidden Test Case)"}
                            </pre>
                          </div>

                          {/* Your Output */}
                          <div>
                            <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                              <span>Your Output:</span>
                              <span className={`text-[10px] font-bold ${activeCase.passed ? "text-emerald-400" : "text-rose-400"}`}>
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

                        {/* Error or Diagnostics */}
                        {activeCase.error && (
                          <div>
                            <div className="text-[11px] font-semibold text-rose-400 mb-1">Diagnostics / Stderr:</div>
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
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(std) => setStudent(std)}
      />
    </div>
  );
};
