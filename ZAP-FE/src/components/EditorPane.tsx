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
    <div className="h-full flex flex-col bg-white dark:bg-[#0b0f17]">
      {/* Editor Header Toolbar */}
      <div className="h-11 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#121824] px-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
            Language:
          </span>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={isRunning}
            className="bg-white dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] border border-[#cbd5e1] dark:border-[#232f45] rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <option value="c">C (GCC)</option>
            <option value="python">Python (3.14)</option>
            <option value="java">Java (21)</option>
            <option value="cpp">C++ (23)</option>
            <option value="node">Node.js (22.8)</option>
          </select>

          {statusText && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-[11px] font-mono text-blue-700 dark:text-blue-300">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
              <span>{statusText}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              disabled={isRunning}
              title={`Reset ${language.toUpperCase()} code`}
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#1a2233] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white text-xs font-medium rounded-lg border border-[#e2e8f0] dark:border-[#232f45] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="px-3 py-1 bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white text-xs font-semibold rounded-lg border border-[#cbd5e1] dark:border-[#232f45] hover:border-blue-500 hover:bg-[#f8fafc] dark:hover:bg-[#232f45] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {isRunning ? "Running..." : "Run code"}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isRunning}
            className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isRunning ? "Evaluating..." : "Submit solution"}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 w-full relative">
        <MonacoEditor
          height="100%"
          language={getMonacoLanguage(language)}
          theme={theme === "dark" ? "vs-dark" : "vs"}
          value={code}
          onChange={(val) => onCodeChange(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "JetBrains Mono, SF Mono, Menlo, monospace",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
};
