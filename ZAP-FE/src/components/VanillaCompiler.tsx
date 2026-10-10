"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  RotateCcw,
  Terminal,
  Bookmark,
  Check,
  Copy,
  Trash2,
  FolderCode,
  ArrowUpRight,
  Code2,
} from "lucide-react";
import { compilerApi, CompilerRunResult } from "@/services/compilerApi";
import { useTheme } from "@/context/ThemeContext";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#0d1117] text-[#656d76] dark:text-[#8b949e] font-mono text-xs">
      Loading editor...
    </div>
  ),
});

export const DEFAULT_TEMPLATES: Record<string, string> = {
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
  java: `public class Solution {
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

export interface SavedSnippet {
  id: string;
  language: string;
  code: string;
  savedAt: string;
}

const STORAGE_SAVED_KEY = "zap_compiler_saved_snippets";

export const VanillaCompiler: React.FC = () => {
  const { theme } = useTheme();
  const [language, setLanguage] = useState<string>("c");

  // In-memory code map: keeps whatever the user types for each language during the session.
  // Resets to DEFAULT_TEMPLATES on page reload as requested.
  const [codeMap, setCodeMap] = useState<Record<string, string>>(DEFAULT_TEMPLATES);

  const [stdin, setStdin] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<CompilerRunResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  // Bottom-right panel tab: 'console' or 'saved'
  const [rightBottomTab, setRightBottomTab] = useState<"console" | "saved">("console");

  // Saved snippets persisted in localStorage
  const [savedSnippets, setSavedSnippets] = useState<SavedSnippet[]>([]);

  // Load saved snippets on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SAVED_KEY);
      if (raw) {
        setSavedSnippets(JSON.parse(raw));
      }
    } catch (_) {}
  }, []);

  const currentCode = codeMap[language] ?? DEFAULT_TEMPLATES[language] ?? "";

  const handleCodeChange = (newCode: string) => {
    setCodeMap((prev) => ({
      ...prev,
      [language]: newCode,
    }));
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    // If the new language was never typed in, ensure it has the default template
    if (codeMap[newLang] === undefined) {
      setCodeMap((prev) => ({
        ...prev,
        [newLang]: DEFAULT_TEMPLATES[newLang] || "",
      }));
    }
  };

  // Reset current language code to default "Hello World!" template
  const handleReset = () => {
    const defaultTemplate = DEFAULT_TEMPLATES[language] || "";
    setCodeMap((prev) => ({
      ...prev,
      [language]: defaultTemplate,
    }));
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 1500);
  };

  // Save current code snippet
  const handleSaveCode = () => {
    const newSnippet: SavedSnippet = {
      id: `snip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      language,
      code: currentCode,
      savedAt: new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updated = [newSnippet, ...savedSnippets];
    setSavedSnippets(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updated));
    } catch (_) {}

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Delete saved snippet
  const handleDeleteSaved = (id: string) => {
    const updated = savedSnippets.filter((s) => s.id !== id);
    setSavedSnippets(updated);
    try {
      localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(updated));
    } catch (_) {}
  };

  // Restore saved snippet into editor
  const handleRestoreSaved = (snippet: SavedSnippet) => {
    setLanguage(snippet.language);
    setCodeMap((prev) => ({
      ...prev,
      [snippet.language]: snippet.code,
    }));
    setRightBottomTab("console");
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setResult(null);
    setRightBottomTab("console");

    try {
      const res = await compilerApi.run({
        language,
        sourceCode: currentCode,
        stdin,
        timeoutMs: 5000,
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      setResult({
        status: "ERROR",
        stdout: "",
        stderr: msg,
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
        return "c";
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

  const getFilename = () => {
    switch (language) {
      case "c":
        return "solution.c";
      case "cpp":
        return "solution.cpp";
      case "java":
        return "Solution.java";
      case "python":
        return "solution.py";
      case "node":
        return "index.js";
      default:
        return "solution.txt";
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#f6f8fa] dark:bg-[#0d1117] overflow-hidden text-[#1f2328] dark:text-[#e6edf3]">
      {/* Top Action Bar */}
      <div className="h-11 border-b border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] px-4 flex items-center justify-between flex-shrink-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-xs text-[#1f2328] dark:text-[#e6edf3]">
            <Terminal className="w-3.5 h-3.5 text-[#0969da] dark:text-[#2f81f7]" />
            <span>Compiler</span>
          </div>

          <div className="h-3.5 w-px bg-[#d0d7de] dark:border-[#30363d] mx-0.5" />

          {/* Language Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#656d76] dark:text-[#8b949e]">
              Language:
            </span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isRunning}
              className="bg-[#f6f8fa] dark:bg-[#0b0e14] text-[#1f2328] dark:text-[#e6edf3] border border-[#d0d7de] dark:border-[#30363d] rounded px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7] cursor-pointer"
            >
              <option value="c">C (GCC)</option>
              <option value="cpp">C++ (23)</option>
              <option value="java">Java (21)</option>
              <option value="python">Python (3.14)</option>
              <option value="node">Node.js (22.8)</option>
            </select>
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Save Code Button */}
          <button
            type="button"
            onClick={handleSaveCode}
            disabled={isRunning}
            title="Save current code snippet"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] transition-colors"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1a7f37] dark:text-[#3fb950]" />
                <span className="text-[#1a7f37] dark:text-[#3fb950]">Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save code</span>
              </>
            )}
          </button>

          {/* Reset Code Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isRunning}
            title="Reset code to default Hello World template"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] hover:bg-[#f6f8fa] dark:hover:bg-[#21262d] transition-colors"
          >
            {resetSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1a7f37] dark:text-[#3fb950]" />
                <span className="text-[#1a7f37] dark:text-[#3fb950]">Reset</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </>
            )}
          </button>

          {/* Run Code Button */}
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-[#0969da] dark:bg-[#2f81f7] text-white hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-50 shadow-xs"
          >
            <Play className={`w-3 h-3 ${isRunning ? "animate-spin" : "fill-current"}`} />
            <span>{isRunning ? "Running..." : "Run code"}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Editor, Right Inputs/Outputs */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Side: Code Editor (fills left half with distinct border) */}
        <div className="flex-1 min-h-0 h-full flex flex-col border-r border-[#d0d7de] dark:border-[#30363d] overflow-hidden bg-white dark:bg-[#0b0e14]">
          {/* Editor Sub-Header Tab */}
          <div className="h-8 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3 flex items-center justify-between text-[11px] text-[#656d76] dark:text-[#8b949e] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-[#0969da] dark:text-[#2f81f7]" />
              <span className="font-mono text-xs text-[#1f2328] dark:text-[#e6edf3] font-medium">
                {getFilename()}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-[#e1e4e8] dark:bg-[#21262d] px-1.5 py-0.2 rounded text-[#656d76] dark:text-[#8b949e]">
              {language}
            </span>
          </div>

          {/* Monaco Editor Container with guaranteed absolute bounds */}
          <div className="flex-1 min-h-0 w-full relative bg-white dark:bg-[#0b0e14]">
            <div className="absolute inset-0">
              <MonacoEditor
                height="100%"
                width="100%"
                language={getMonacoLang(language)}
                theme={theme === "dark" ? "vs-dark" : "vs"}
                value={currentCode}
                onChange={(val) => handleCodeChange(val ?? "")}
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
        </div>

        {/* Right Side: Split into Top (Input) & Bottom (Output / Saved) */}
        <div className="w-[45%] min-w-[340px] max-w-[620px] h-full flex flex-col bg-[#f6f8fa] dark:bg-[#0d1117] overflow-hidden">
          {/* Top Half: Standard Input */}
          <div className="h-1/2 flex flex-col border-b border-[#d0d7de] dark:border-[#30363d] overflow-hidden bg-white dark:bg-[#161b22]">
            <div className="h-8 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3 flex items-center justify-between text-[11px] font-medium text-[#656d76] dark:text-[#8b949e] flex-shrink-0">
              <span>Standard input (stdin)</span>
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

            <div className="flex-1 min-h-0 p-3 bg-white dark:bg-[#0b0e14]">
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter standard input data here (optional)..."
                className="w-full h-full resize-none p-2.5 rounded border border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] font-mono text-xs text-[#1f2328] dark:text-[#e6edf3] placeholder-[#8c959f] focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7]"
              />
            </div>
          </div>

          {/* Bottom Half: Console Output & Saved Codes Tabs */}
          <div className="h-1/2 flex flex-col overflow-hidden bg-white dark:bg-[#0b0e14]">
            {/* Tabs Header */}
            <div className="h-8 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3 flex items-center justify-between text-[11px] font-medium flex-shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRightBottomTab("console")}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors ${
                    rightBottomTab === "console"
                      ? "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#e6edf3] font-medium border border-[#d0d7de] dark:border-[#30363d]"
                      : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                  }`}
                >
                  <Terminal className="w-3 h-3 text-[#0969da] dark:text-[#2f81f7]" />
                  <span>Output</span>
                  {result && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                        result.status === "SUCCESS"
                          ? "text-[#1a7f37] dark:text-[#3fb950] bg-[#dafbe1] dark:bg-[#2ea043]/15 border-[#1a7f37]/20 dark:border-[#3fb950]/30"
                          : "text-[#cf222e] dark:text-[#f85149] bg-[#ffebe9] dark:bg-[#f85149]/10 border-[#cf222e]/20 dark:border-[#f85149]/30"
                      }`}
                    >
                      {result.status === "SUCCESS" ? "Success" : "Error"}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setRightBottomTab("saved")}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors ${
                    rightBottomTab === "saved"
                      ? "bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#e6edf3] font-medium border border-[#d0d7de] dark:border-[#30363d]"
                      : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
                  }`}
                >
                  <FolderCode className="w-3 h-3 text-[#0969da] dark:text-[#2f81f7]" />
                  <span>Saved codes</span>
                  <span className="text-[10px] bg-[#e1e4e8] dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] px-1 py-0.2 rounded font-mono">
                    {savedSnippets.length}
                  </span>
                </button>
              </div>

              {rightBottomTab === "console" && (
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
                      className="text-[10px] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] flex items-center gap-1"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-[#1a7f37] dark:text-[#3fb950]" />
                          <span>Copied</span>
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
              )}
            </div>

            {/* TAB CONTENT 1: CONSOLE OUTPUT */}
            {rightBottomTab === "console" && (
              <div className="flex-1 min-h-0 p-3 overflow-y-auto font-mono text-xs leading-relaxed bg-white dark:bg-[#0b0e14]">
                {isRunning ? (
                  <div className="h-full flex items-center justify-center text-[#8c959f] text-xs">
                    <span className="animate-pulse">Executing code in sandbox...</span>
                  </div>
                ) : result ? (
                  <div className="space-y-2.5">
                    {result.stdout && (
                      <div>
                        <div className="text-[10px] text-[#656d76] dark:text-[#8b949e] mb-1 font-sans">
                          Output:
                        </div>
                        <pre className="p-2.5 rounded bg-[#f6f8fa] dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] text-[#1f2328] dark:text-[#e6edf3] whitespace-pre-wrap select-text">
                          {result.stdout}
                        </pre>
                      </div>
                    )}

                    {result.stderr && (
                      <div>
                        <div className="text-[10px] text-[#cf222e] dark:text-[#f85149] mb-1 font-sans">
                          Error output:
                        </div>
                        <pre className="p-2.5 rounded bg-[#cf222e]/5 dark:bg-[#f85149]/10 border border-[#cf222e]/20 dark:border-[#f85149]/20 text-[#cf222e] dark:text-[#f85149] whitespace-pre-wrap select-text">
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
            )}

            {/* TAB CONTENT 2: SAVED CODES */}
            {rightBottomTab === "saved" && (
              <div className="flex-1 min-h-0 p-3 overflow-y-auto bg-white dark:bg-[#0b0e14]">
                {savedSnippets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <FolderCode className="w-8 h-8 text-[#8c959f] mb-2 opacity-50" />
                    <span className="text-xs font-medium text-[#1f2328] dark:text-[#e6edf3]">
                      No saved codes yet
                    </span>
                    <span className="text-[11px] text-[#656d76] dark:text-[#8b949e] mt-1 max-w-xs">
                      Click &quot;Save code&quot; in the top bar to save your current snippet. Saved codes persist across page refreshes.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedSnippets.map((snip) => (
                      <div
                        key={snip.id}
                        className="p-2.5 rounded border border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono uppercase bg-[#0969da]/10 dark:bg-[#2f81f7]/15 text-[#0969da] dark:text-[#2f81f7] px-1.5 py-0.2 rounded font-semibold">
                              {snip.language}
                            </span>
                            <span className="text-[10px] text-[#656d76] dark:text-[#8b949e]">
                              {snip.savedAt}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRestoreSaved(snip)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#0969da] text-white hover:opacity-90 transition-opacity"
                            >
                              <span>Load</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSaved(snip.id)}
                              title="Delete snippet"
                              className="p-1 text-[#656d76] dark:text-[#8b949e] hover:text-[#cf222e] dark:hover:text-[#f85149] rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Code preview snippet */}
                        <pre className="text-[11px] font-mono text-[#656d76] dark:text-[#8b949e] line-clamp-2 overflow-hidden bg-white dark:bg-[#0b0e14] p-1.5 rounded border border-[#d0d7de]/60 dark:border-[#30363d]/60">
                          {snip.code.trim()}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
