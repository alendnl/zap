"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

// Dynamically load Monaco Editor with SSR disabled
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-slate-500 font-mono text-sm">
      Loading Monaco Editor...
    </div>
  ),
});

interface EditorPaneProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  code: string;
  onCodeChange: (code: string) => void;
  onRun: () => void;
  onSubmit: () => void;
  onReset?: () => void;
  isRunning: boolean;
  statusText?: string;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  language,
  onLanguageChange,
  code,
  onCodeChange,
  onRun,
  onSubmit,
  onReset,
  isRunning,
  statusText,
}) => {
  const { theme } = useTheme();

  const getMonacoLanguage = (lang: string) => {
    switch (lang.toLowerCase()) {
      case "c":
        return "c";
      case "python":
        return "python";
      case "java":
        return "java";
      case "cpp":
        return "cpp";
      case "node":
      case "javascript":
        return "javascript";
      default:
        return "plaintext";
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950">
      {/* Editor Header Toolbar */}
      <div className="h-12 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 select-none">
            Language:
          </label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={isRunning}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <option value="c">C (GCC)</option>
            <option value="python">Python (3.14)</option>
            <option value="java">Java (21)</option>
            <option value="cpp">C++ (23)</option>
            <option value="node">Node.js (22.8)</option>
          </select>

          {statusText && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-sky-600 dark:text-sky-400 border border-slate-300 dark:border-slate-700 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              {statusText}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              disabled={isRunning}
              title={`Reset ${language.toUpperCase()} code to template`}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
          <button
            onClick={onRun}
            disabled={isRunning}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Code"}
          </button>
          <button
            onClick={onSubmit}
            disabled={isRunning}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md shadow-sm transition-colors disabled:opacity-50"
          >
            {isRunning ? "Evaluating..." : "Submit"}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 w-full relative">
        <MonacoEditor
          height="100%"
          language={getMonacoLanguage(language)}
          theme={theme === "dark" ? "vs-dark" : "light"}
          value={code}
          onChange={(val) => onCodeChange(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
};
