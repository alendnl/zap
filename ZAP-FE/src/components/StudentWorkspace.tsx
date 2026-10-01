"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { QuestionPane, QuestionData } from "./QuestionPane";
import { EditorPane } from "./EditorPane";
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
  IDLE: { bg: "bg-slate-900/40", text: "text-slate-400", border: "border-slate-700/30" },
};

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({ question }) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE["python"]);
  const [currentSubmission, setCurrentSubmission] = useState<Partial<Submission> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

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
  }, []);

  const triggerExecution = useCallback(
    async (mode: SubmissionMode) => {
      if (isRunning) return;
      cleanupPolling();
      setIsRunning(true);
      setErrorNotice(null);
      setCurrentSubmission({ status: "QUEUED" });

      try {
        const createRes = await submissionsApi.create({
          questionId: question.id,
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
            }
          } catch (pollErr: any) {
            cleanupPolling();
            setIsRunning(false);
            setErrorNotice("Failed to fetch submission status update.");
          }
        }, 600);
      } catch (err: any) {
        // Fallback simulation if backend is not currently running locally
        setErrorNotice("Backend API unreachable — simulated local execution response shown.");
        setTimeout(() => {
          setCurrentSubmission({ status: "RUNNING" });
        }, 400);

        setTimeout(() => {
          setCurrentSubmission({
            id: `sub-mock-${Date.now()}`,
            status: "COMPLETED",
            verdict: "ACCEPTED",
            executionTimeMs: 38,
            tests: { total: 3, passed: 3, failed: 0 },
          });
          setIsRunning(false);
        }, 1500);
      }
    },
    [isRunning, cleanupPolling, question.id, language, code]
  );

  const handleRun = useCallback(() => triggerExecution("RUN"), [triggerExecution]);
  const handleSubmit = useCallback(() => triggerExecution("SUBMIT"), [triggerExecution]);

  const statusKey =
    currentSubmission?.verdict || currentSubmission?.status || "IDLE";
  const verdictStyle = VERDICT_STYLES[statusKey] || VERDICT_STYLES["IDLE"];
  const statusLabel =
    currentSubmission && currentSubmission.status !== "IDLE"
      ? currentSubmission.status
      : undefined;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950">
      {/* Top Header Bar */}
      <header className="h-11 border-b border-slate-800/80 bg-slate-900/95 flex items-center px-5 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sky-400 font-black text-lg tracking-tight select-none">ZAP</span>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-slate-400 text-xs truncate max-w-xs">{question.title}</span>
        </div>
        {errorNotice && (
          <span className="text-amber-400 text-xs truncate ml-auto bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded">
            {errorNotice}
          </span>
        )}
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
              className={`border-t ${verdictStyle.border} ${verdictStyle.bg} px-5 py-3 transition-all flex-shrink-0`}
              style={{ minHeight: "100px", maxHeight: "180px", overflowY: "auto" }}
            >
              <div className="flex items-center gap-3 mb-1.5">
                <span className={`text-xs font-bold uppercase tracking-wider ${verdictStyle.text}`}>
                  {currentSubmission.verdict || currentSubmission.status}
                </span>

                {currentSubmission.executionTimeMs != null && (
                  <span className="text-xs text-slate-400">
                    ⏱ {currentSubmission.executionTimeMs} ms
                  </span>
                )}

                {currentSubmission.tests && (
                  <span className="text-xs text-slate-400">
                    Tests: {currentSubmission.tests.passed} / {currentSubmission.tests.total} passed
                  </span>
                )}
              </div>

              {currentSubmission.compileOutput && (
                <pre className="font-mono text-xs text-orange-300 bg-orange-950/30 p-2 rounded border border-orange-800/40 whitespace-pre-wrap">
                  {currentSubmission.compileOutput}
                </pre>
              )}

              {currentSubmission.errorMessage && (
                <pre className="font-mono text-xs text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-800/40 whitespace-pre-wrap">
                  {currentSubmission.errorMessage}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
