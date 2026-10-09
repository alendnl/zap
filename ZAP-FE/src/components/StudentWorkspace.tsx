"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { QuestionPane, QuestionData } from "./QuestionPane";
import { EditorPane } from "./EditorPane";
import { questionsApi } from "@/services/questionsApi";
import {
  submissionsApi,
  Submission,
  isTerminalStatus,
  SubmissionMode,
} from "@/services/submissionsApi";

interface StudentWorkspaceProps {
  question: QuestionData;
}

const DEFAULT_CODE: Record<string, string> = {
  python: `import sys

def solution():
    # Read input from standard input
    data = sys.stdin.read().split()
    # Write your solution here
    pass

if __name__ == "__main__":
    solution()
`,
  java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Write your solution here
    }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // Write your solution here
    return 0;
}
`,
  node: `const fs = require("fs");
const input = fs.readFileSync("/dev/stdin", "utf-8").trim().split("\\n");

// Write your solution here
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

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({ question }) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE["python"]);
  const [currentSubmission, setCurrentSubmission] = useState<Partial<Submission> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanupPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupPolling();
  }, [cleanupPolling]);

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang] || "");
    setCurrentSubmission(null);
    setErrorNotice(null);
    setSelectedCaseIdx(0);
  }, []);

  const triggerExecution = useCallback(
    async (mode: SubmissionMode) => {
      if (isRunning) return;
      cleanupPolling();
      setIsRunning(true);
      setErrorNotice(null);
      setSelectedCaseIdx(0);
      setCurrentSubmission({ status: "QUEUED" });

      try {
        const publishedQuestions = await questionsApi.list("PUBLISHED");
        const backendQuestion = publishedQuestions.find(
          (candidate) => candidate.id === question.id || candidate.slug === question.slug
        );

        if (!backendQuestion) {
          throw new Error(
            `Question "${question.slug}" is not published in the selected environment. Check the Prod/QA question bank.`
          );
        }

        const createRes = await submissionsApi.create({
          questionId: backendQuestion.id,
          language,
          mode,
          sourceCode: code,
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
      <header className="h-11 border-b border-slate-800/80 bg-slate-900/95 flex items-center px-5 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sky-400 font-black text-lg tracking-tight select-none">ZAP</span>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-slate-400 text-xs truncate max-w-xs">{question.title}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {errorNotice && (
            <span className="text-amber-400 text-xs truncate bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">
              {errorNotice}
            </span>
          )}
          <Link
            href="/faculty/questions"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700 transition-colors"
          >
            Faculty Portal →
          </Link>
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
    </div>
  );
};
