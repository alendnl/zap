"use client";

import React, { useState, useCallback } from "react";
import { QuestionPane, QuestionData } from "./QuestionPane";
import { EditorPane } from "./EditorPane";

type SubmissionStatus = "IDLE" | "QUEUED" | "RUNNING" | "ACCEPTED" | "WRONG_ANSWER" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED";

interface SubmissionResult {
  status: SubmissionStatus;
  verdict?: string;
  output?: string;
  error?: string;
  testsPassed?: number;
  testsTotal?: number;
  executionTimeMs?: number;
}

interface StudentWorkspaceProps {
  question: QuestionData;
}

const DEFAULT_CODE: Record<string, string> = {
  python: `import sys

def solution():
    # Read input
    data = sys.stdin.read().split()
    # Your solution here
    pass

solution()
`,
  java: `import java.util.Scanner;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        // Your solution here
    }
}
`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // Your solution here
    return 0;
}
`,
  node: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').trim().split('\\n');
// Your solution here
`,
};

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ACCEPTED: { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-700/50" },
  WRONG_ANSWER: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-700/50" },
  COMPILE_ERROR: { bg: "bg-orange-950/60", text: "text-orange-400", border: "border-orange-700/50" },
  RUNTIME_ERROR: { bg: "bg-red-950/60", text: "text-red-400", border: "border-red-700/50" },
  TIME_LIMIT_EXCEEDED: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-700/50" },
  QUEUED: { bg: "bg-sky-950/60", text: "text-sky-400", border: "border-sky-700/50" },
  RUNNING: { bg: "bg-sky-950/60", text: "text-sky-400", border: "border-sky-700/50" },
  IDLE: { bg: "bg-slate-900/40", text: "text-slate-400", border: "border-slate-700/30" },
};

function simulateMockedSubmission(
  onStatusChange: (s: SubmissionResult) => void
) {
  onStatusChange({ status: "QUEUED" });
  setTimeout(() => onStatusChange({ status: "RUNNING" }), 600);
  setTimeout(() => {
    // Randomly simulate success or failure for demo purposes
    const outcomes: SubmissionResult[] = [
      { status: "ACCEPTED", verdict: "ACCEPTED", testsPassed: 5, testsTotal: 5, executionTimeMs: 42 },
      { status: "WRONG_ANSWER", verdict: "WRONG_ANSWER", testsPassed: 3, testsTotal: 5 },
      { status: "COMPILE_ERROR", verdict: "COMPILE_ERROR", error: "SyntaxError: invalid syntax (line 5)" },
    ];
    onStatusChange(outcomes[Math.floor(Math.random() * outcomes.length)]);
  }, 2000);
}

export const StudentWorkspace: React.FC<StudentWorkspaceProps> = ({ question }) => {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(DEFAULT_CODE["python"]);
  const [result, setResult] = useState<SubmissionResult>({ status: "IDLE" });
  const [isRunning, setIsRunning] = useState(false);

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang] || "");
    setResult({ status: "IDLE" });
  }, []);

  const handleRun = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setResult({ status: "QUEUED" });
    simulateMockedSubmission((s) => {
      setResult(s);
      if (!["QUEUED", "RUNNING"].includes(s.status)) {
        setIsRunning(false);
      }
    });
  }, [isRunning]);

  const handleSubmit = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setResult({ status: "QUEUED" });
    simulateMockedSubmission((s) => {
      setResult(s);
      if (!["QUEUED", "RUNNING"].includes(s.status)) {
        setIsRunning(false);
      }
    });
  }, [isRunning]);

  const verdictStyle = VERDICT_STYLES[result.status] || VERDICT_STYLES["IDLE"];
  const statusText = result.status !== "IDLE" ? result.status : undefined;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950">
      {/* Top Header Bar */}
      <header className="h-11 border-b border-slate-800/80 bg-slate-900/95 flex items-center px-5 gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sky-400 font-black text-lg tracking-tight select-none">ZAP</span>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-slate-400 text-xs truncate max-w-xs">{question.title}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Pane */}
        <div className="w-[40%] min-w-[300px] max-w-[600px] overflow-hidden">
          <QuestionPane question={question} />
        </div>

        {/* Vertical Divider */}
        <div className="w-px bg-slate-800 flex-shrink-0" />

        {/* Editor + Output Pane */}
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
              statusText={statusText}
            />
          </div>

          {/* Output Panel */}
          {result.status !== "IDLE" && (
            <div
              className={`border-t ${verdictStyle.border} ${verdictStyle.bg} px-5 py-3 transition-all`}
              style={{ minHeight: "90px", maxHeight: "160px" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-xs font-bold uppercase tracking-widest ${verdictStyle.text}`}>
                  {result.verdict || result.status}
                </span>
                {result.executionTimeMs != null && (
                  <span className="text-xs text-slate-500">{result.executionTimeMs}ms</span>
                )}
                {result.testsPassed != null && result.testsTotal != null && (
                  <span className="text-xs text-slate-500">
                    Tests: {result.testsPassed}/{result.testsTotal}
                  </span>
                )}
              </div>
              {result.error && (
                <pre className="font-mono text-xs text-rose-300 opacity-80 whitespace-pre-wrap overflow-auto max-h-24">
                  {result.error}
                </pre>
              )}
              {result.output && (
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap overflow-auto max-h-24">
                  {result.output}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
