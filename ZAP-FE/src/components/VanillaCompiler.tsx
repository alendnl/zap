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
    <div className="h-full w-full flex flex-col bg-[#f8fafc] dark:bg-[#0b0f17] overflow-hidden text-[#0f172a] dark:text-[#f8fafc] transition-colors duration-200">
      {/* Top Action Bar */}
      <div className="h-12 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 flex items-center justify-between flex-shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-xs text-[#0f172a] dark:text-white">
            <div className="w-6 h-6 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span>Compiler</span>
          </div>

          <div className="h-4 w-px bg-[#e2e8f0] dark:bg-[#1e293b] mx-0.5" />

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
              Language:
            </span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isRunning}
              className="bg-[#f8fafc] dark:bg-[#1a2233] text-[#0f172a] dark:text-[#f8fafc] border border-[#e2e8f0] dark:border-[#232f45] rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
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
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white transition-all cursor-pointer"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            )}
          </button>

          {/* Reset Code Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={isRunning}
            title="Reset code to default Hello World template"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white transition-all cursor-pointer"
          >
            {resetSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Reset</span>
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
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3 h-3 ${isRunning ? "animate-spin" : "fill-current"}`} />
            <span>{isRunning ? "Running..." : "Run"}</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Editor, Right Inputs/Outputs */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: Code Editor */}
        <div className="flex-1 min-h-0 h-full flex flex-col border-b md:border-b-0 md:border-r border-[#e2e8f0] dark:border-[#1e293b] overflow-hidden bg-white dark:bg-[#0b0f17]">
          {/* Editor Sub-Header Tab */}
          <div className="h-9 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824] px-3.5 flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="font-mono text-xs text-[#0f172a] dark:text-[#f8fafc] font-semibold">
                {getFilename()}
              </span>
            </div>
            <span className="text-[10px] font-mono uppercase bg-[#f1f5f9] dark:bg-[#1a2233] px-2 py-0.5 rounded-md text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#232f45]">
              {language}
            </span>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 min-h-0 w-full relative bg-white dark:bg-[#0b0f17]">
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
        <div className="w-full md:w-[45%] md:min-w-[340px] md:max-w-[620px] h-full flex flex-col bg-[#f8fafc] dark:bg-[#0b0f17] overflow-hidden">
          {/* Top Half: Standard Input */}
          <div className="h-1/2 flex flex-col border-b border-[#e2e8f0] dark:border-[#1e293b] overflow-hidden bg-white dark:bg-[#121824]">
            <div className="h-9 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824] px-3.5 flex items-center justify-between text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] flex-shrink-0">
              <span>Standard input (stdin)</span>
              {stdin && (
                <button
                  type="button"
                  onClick={() => setStdin("")}
                  className="text-[10px] text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 min-h-0 p-3 bg-white dark:bg-[#0b0f17]">
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter standard input data here (optional)..."
                className="w-full h-full resize-none p-3 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824] font-mono text-xs text-[#0f172a] dark:text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Bottom Half: Console Output & Saved Codes Tabs */}
          <div className="h-1/2 flex flex-col overflow-hidden bg-white dark:bg-[#0b0f17]">
            {/* Tabs Header */}
            <div className="h-9 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824] px-3 flex items-center justify-between text-xs font-semibold flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRightBottomTab("console")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    rightBottomTab === "console"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Output</span>
                  {result && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                        result.status === "SUCCESS"
                          ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                          : "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/20"
                      }`}
                    >
                      {result.status === "SUCCESS" ? "Success" : "Error"}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setRightBottomTab("saved")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                    rightBottomTab === "saved"
                      ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold border border-[#e2e8f0] dark:border-[#232f45] shadow-xs"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                  }`}
                >
                  <FolderCode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Saved codes</span>
                  <span className="text-[10px] bg-[#f1f5f9] dark:bg-[#1a2233] text-[#64748b] dark:text-[#94a3b8] px-1.5 py-0.2 rounded-md font-mono border border-[#e2e8f0] dark:border-[#232f45]">
                    {savedSnippets.length}
                  </span>
                </button>
              </div>

              {rightBottomTab === "console" && (
                <div className="flex items-center gap-2">
                  {result && result.executionTimeMs > 0 && (
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-[#94a3b8]">
                      {result.executionTimeMs} ms
                    </span>
                  )}
                  {(result?.stdout || result?.stderr) && (
                    <button
                      type="button"
                      onClick={copyOutput}
                      className="text-[10px] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
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
              <div className="flex-1 min-h-0 p-3.5 overflow-y-auto font-mono text-xs leading-relaxed bg-white dark:bg-[#0b0f17]">
                {isRunning ? (
                  <div className="h-full flex items-center justify-center text-[#64748b] dark:text-[#94a3b8] text-xs">
                    <span className="animate-pulse">Executing code in sandbox...</span>
                  </div>
                ) : result ? (
                  <div className="space-y-3">
                    {result.stdout && (
                      <div>
                        <div className="text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8] mb-1 font-sans">
                          Output:
                        </div>
                        <pre className="p-3 rounded-xl bg-[#f8fafc] dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] text-[#0f172a] dark:text-[#f8fafc] whitespace-pre-wrap select-text">
                          {result.stdout}
                        </pre>
                      </div>
                    )}

                    {result.stderr && (
                      <div>
                        <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mb-1 font-sans">
                          Error output:
                        </div>
                        <pre className="p-3 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/25 text-rose-600 dark:text-rose-400 whitespace-pre-wrap select-text">
                          {result.stderr}
                        </pre>
                      </div>
                    )}

                    {!result.stdout && !result.stderr && (
                      <div className="text-[#64748b] dark:text-[#94a3b8] text-xs p-4 text-center">
                        Process exited with code {result.exitCode} (no output).
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-[#64748b] dark:text-[#94a3b8] text-xs">
                    <span>Output will appear here after running.</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT 2: SAVED CODES */}
            {rightBottomTab === "saved" && (
              <div className="flex-1 min-h-0 p-3.5 overflow-y-auto bg-white dark:bg-[#0b0f17]">
                {savedSnippets.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <FolderCode className="w-8 h-8 text-[#64748b] dark:text-[#94a3b8] mb-2 opacity-50" />
                    <span className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      No saved codes yet
                    </span>
                    <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] mt-1 max-w-xs">
                      Click &quot;Save&quot; in the top bar to save your current snippet. Saved codes persist across page refreshes.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {savedSnippets.map((snip) => (
                      <div
                        key={snip.id}
                        className="p-3 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] flex flex-col gap-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono uppercase bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-semibold">
                              {snip.language}
                            </span>
                            <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                              {snip.savedAt}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRestoreSaved(snip)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer"
                            >
                              <span>Load</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSaved(snip.id)}
                              title="Delete snippet"
                              className="p-1 text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Code preview snippet */}
                        <pre className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] line-clamp-2 overflow-hidden bg-[#f8fafc] dark:bg-[#0b0f17] p-2 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b]">
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
