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
    <div className="h-full w-full flex flex-col bg-[#f6f8fa] dark:bg-[#0d1117] overflow-hidden text-[#1f2328] dark:text-[#e6edf3]">
      {/* Top Action Bar */}
      <div className="h-11 border-b border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#656d76] dark:text-[#8b949e]" />
            <span className="text-xs font-semibold">
              Vanilla compiler
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#d0d7de] dark:bg-[#30363d] mx-0.5" />

          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#656d76] dark:text-[#8b949e]">
              Language:
            </span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isRunning}
              className="bg-[#f6f8fa] dark:bg-[#0b0e14] text-[#1f2328] dark:text-[#e6edf3] border border-[#d0d7de] dark:border-[#30363d] rounded px-2 py-0.5 text-xs font-medium focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7] cursor-pointer"
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
            title="Reset code to default template"
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-[#0969da] dark:bg-[#2f81f7] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${isRunning ? "animate-spin" : "fill-current"}`} />
            <span>{isRunning ? "Running..." : "Run code"}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Editor, Right Inputs/Outputs */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Code Editor */}
        <div className="flex-1 h-full border-r border-[#d0d7de] dark:border-[#30363d] flex flex-col overflow-hidden bg-white dark:bg-[#0b0e14]">
          <div className="h-7 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3 flex items-center justify-between text-[11px] text-[#656d76] dark:text-[#8b949e]">
            <span className="font-mono text-[11px]">
              main.
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
            <span className="text-[10px] font-mono capitalize">
              {language}
            </span>
          </div>

          <div className="flex-1 w-full relative">
            <MonacoEditor
              height="100%"
              language={getMonacoLang(language)}
              theme={theme === "dark" ? "vs-dark" : "vs"}
              value={currentCode}
              onChange={(val) => handleCodeChange(val || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "JetBrains Mono, SF Mono, Menlo, monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                padding: { top: 8 },
              }}
            />
          </div>
        </div>

        {/* Right Side: Split into Top (Input) & Bottom (Output) */}
        <div className="w-[42%] min-w-[320px] max-w-[560px] h-full flex flex-col bg-[#f6f8fa] dark:bg-[#0d1117] overflow-hidden">
          {/* Top Half: Standard Input */}
          <div className="h-1/2 flex flex-col border-b border-[#d0d7de] dark:border-[#30363d] overflow-hidden">
            <div className="h-7 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3 flex items-center justify-between text-[11px] font-medium text-[#656d76] dark:text-[#8b949e] flex-shrink-0">
              <span>Standard input</span>
              {stdin && (
                <button
                  type="button"
                  onClick={() => setStdin("")}
                  className="text-[10px] text-[#656d76] dark:text-[#8b949e] hover:text-[#cf222e] dark:hover:text-[#f85149] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 p-2.5">
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Data provided to standard input (stdin)..."
                className="w-full h-full resize-none p-2.5 rounded border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#0b0e14] font-mono text-xs text-[#1f2328] dark:text-[#e6edf3] placeholder-[#8c959f] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7]"
              />
            </div>
          </div>

          {/* Bottom Half: Standard Output */}
          <div className="h-1/2 flex flex-col overflow-hidden bg-white dark:bg-[#0b0e14]">
            <div className="h-7 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3 flex items-center justify-between text-[11px] font-medium text-[#656d76] dark:text-[#8b949e] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span>Output</span>
                {result && (
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                      result.status === "SUCCESS"
                        ? "text-[#1a7f37] dark:text-[#3fb950] bg-[#dafbe1] dark:bg-[#2ea043]/15 border-[#1a7f37]/20 dark:border-[#3fb950]/30"
                        : "text-[#cf222e] dark:text-[#f85149] bg-[#ffebe9] dark:bg-[#f85149]/15 border-[#cf222e]/20 dark:border-[#f85149]/30"
                    }`}
                  >
                    {result.status === "SUCCESS" ? "Success" : "Error"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {result && result.executionTimeMs > 0 && (
                  <span className="text-[10px] font-mono text-[#8c959f]">
                    {result.executionTimeMs} ms
                  </span>
                )}
                {(result?.stdout || result?.stderr) && (
                  <button
                    type="button"
                    onClick={copyOutput}
                    className="text-[10px] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            </div>

            {/* Output Screen */}
            <div className="flex-1 p-2.5 overflow-y-auto font-mono text-xs leading-relaxed">
              {isRunning ? (
                <div className="h-full flex items-center justify-center text-[#8c959f] text-xs">
                  <span>Running code...</span>
                </div>
              ) : result ? (
                <div className="space-y-2">
                  {result.stdout && (
                    <div>
                      <div className="text-[10px] text-[#8c959f] mb-1">
                        stdout
                      </div>
                      <pre className="p-2.5 rounded bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] text-[#1f2328] dark:text-[#e6edf3] whitespace-pre-wrap select-text">
                        {result.stdout}
                      </pre>
                    </div>
                  )}

                  {result.stderr && (
                    <div>
                      <div className="text-[10px] text-[#cf222e] dark:text-[#f85149] mb-1">
                        stderr / diagnostics
                      </div>
                      <pre className="p-2.5 rounded bg-[#ffebe9] dark:bg-[#f85149]/10 border border-[#cf222e]/20 text-[#cf222e] dark:text-[#f85149] whitespace-pre-wrap select-text">
                        {result.stderr}
                      </pre>
                    </div>
                  )}

                  {!result.stdout && !result.stderr && (
                    <div className="text-[#8c959f] text-[11px] p-2 text-center">
                      Process exited with code {result.exitCode} (no output).
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-[#8c959f] text-xs">
                  <span>Output will appear here after running.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
