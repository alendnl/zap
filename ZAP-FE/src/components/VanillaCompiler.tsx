"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  RotateCcw,
  Terminal,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Copy,
  Check,
  Trash2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { compilerApi, CompilerRunResult } from "@/services/compilerApi";
import { useTheme } from "@/context/ThemeContext";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-900/50 dark:bg-[#0d121f] text-slate-400 font-mono text-sm">
      Loading Monaco Editor...
    </div>
  ),
});

const DEFAULT_TEMPLATES: Record<string, string> = {
  c: `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
`,
  cpp: `#include <iostream>

using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`,
  python: `# Python 3
print("Hello, World!")
`,
  node: `// Node.js
console.log("Hello, World!");
`,
};

export const VanillaCompiler: React.FC = () => {
  const { theme } = useTheme();
  const [language, setLanguage] = useState<string>("python");
  const [codeMap, setCodeMap] = useState<Record<string, string>>(DEFAULT_TEMPLATES);
  const [stdin, setStdin] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<CompilerRunResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Restore saved code from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("zap-vanilla-compiler-codes");
      if (saved) {
        setCodeMap((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
      const savedLang = localStorage.getItem("zap-vanilla-compiler-lang");
      if (savedLang && DEFAULT_TEMPLATES[savedLang]) {
        setLanguage(savedLang);
      }
    } catch (_) {}
  }, []);

  const currentCode = codeMap[language] || DEFAULT_TEMPLATES[language] || "";

  const handleCodeChange = (newCode: string) => {
    setCodeMap((prev) => {
      const updated = { ...prev, [language]: newCode };
      try {
        localStorage.setItem("zap-vanilla-compiler-codes", JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    try {
      localStorage.setItem("zap-vanilla-compiler-lang", newLang);
    } catch (_) {}
  };

  const handleReset = () => {
    if (confirm(`Reset ${language.toUpperCase()} code to Hello World template?`)) {
      handleCodeChange(DEFAULT_TEMPLATES[language] || "");
    }
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResult(null);

    try {
      const res = await compilerApi.run({
        language,
        sourceCode: currentCode,
        stdin,
        timeoutMs: 5000,
      });
      setResult(res);
    } catch (err: any) {
      setResult({
        status: "ERROR",
        stdout: "",
        stderr: err?.message || "Execution failed",
        exitCode: 1,
        executionTimeMs: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyOutput = () => {
    const textToCopy = result?.stdout || result?.stderr || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMonacoLang = (lang: string) => {
    switch (lang) {
      case "c":
      case "cpp":
        return "cpp";
      case "java":
        return "java";
      case "python":
        return "python";
      case "node":
        return "javascript";
      default:
        return "plaintext";
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#070b14] overflow-hidden text-slate-800 dark:text-slate-200">
      {/* Top Action Bar */}
      <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Vanilla Compiler
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 select-none">
              Language:
            </label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isRunning}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 transition-colors cursor-pointer"
            >
              <option value="python">Python (3.14)</option>
              <option value="c">C (GCC)</option>
              <option value="cpp">C++ (23)</option>
              <option value="java">Java (21)</option>
              <option value="node">Node.js (22.8)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isRunning}
            title="Reset code to default Hello World"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : "fill-current"}`} />
            <span>{isRunning ? "Running..." : "Run Code"}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Editor, Right Inputs/Outputs */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Code Editor */}
        <div className="flex-1 h-full border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden bg-white dark:bg-[#0c111d]">
          <div className="h-8 border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 px-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono">
              source.
              {language === "python"
                ? "py"
                : language === "c"
                ? "c"
                : language === "cpp"
                ? "cpp"
                : language === "java"
                ? "java"
                : "js"}
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {language}
            </span>
          </div>

          <div className="flex-1 w-full relative">
            <MonacoEditor
              height="100%"
              language={getMonacoLang(language)}
              theme={theme === "dark" ? "vs-dark" : "light"}
              value={currentCode}
              onChange={(val) => handleCodeChange(val || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                padding: { top: 12 },
              }}
            />
          </div>
        </div>

        {/* Right Side: Split into Top (Input) & Bottom (Output) */}
        <div className="w-[45%] min-w-[340px] max-w-[650px] h-full flex flex-col bg-slate-50 dark:bg-[#090d16] overflow-hidden">
          {/* Top Half: Standard Input (stdin) */}
          <div className="h-1/2 flex flex-col border-b border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="h-9 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 px-4 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span>Standard Input (stdin)</span>
              </div>
              {stdin && (
                <button
                  type="button"
                  onClick={() => setStdin("")}
                  title="Clear input"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-3">
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter input to pass to your program via standard input..."
                className="w-full h-full resize-none p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-mono text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
            </div>
          </div>

          {/* Bottom Half: Standard Output (stdout & stderr) */}
          <div className="h-1/2 flex flex-col overflow-hidden bg-white dark:bg-[#070b14]">
            <div className="h-9 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/60 px-4 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <span>Output</span>
                {result && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      result.status === "SUCCESS"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {result.status === "SUCCESS" ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <XCircle className="w-3 h-3" />
                    )}
                    {result.status}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {result && result.executionTimeMs > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{result.executionTimeMs}ms</span>
                  </div>
                )}
                {(result?.stdout || result?.stderr) && (
                  <button
                    type="button"
                    onClick={copyOutput}
                    title="Copy output"
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px] flex items-center gap-1 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Output Screen */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-relaxed">
              {isRunning ? (
                <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  <span>Compiling and executing code...</span>
                </div>
              ) : result ? (
                <div className="space-y-3">
                  {result.stdout && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        Standard Output:
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-text">
                        {result.stdout}
                      </pre>
                    </div>
                  )}

                  {result.stderr && (
                    <div>
                      <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider mb-1">
                        Errors / Diagnostics:
                      </div>
                      <pre className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 whitespace-pre-wrap select-text">
                        {result.stderr}
                      </pre>
                    </div>
                  )}

                  {!result.stdout && !result.stderr && (
                    <div className="text-slate-400 dark:text-slate-500 italic p-3 text-center">
                      (Program finished with exit code {result.exitCode} and produced no output)
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-center space-y-1 select-none">
                  <Terminal className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-700 mb-1" />
                  <p className="text-xs font-medium">No output yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-600">
                    Click &ldquo;Run Code&rdquo; above to execute your program.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
