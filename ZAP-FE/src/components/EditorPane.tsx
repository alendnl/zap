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
    <div className="h-full flex flex-col bg-white dark:bg-[#0b0e14]">
      {/* Editor Header Toolbar */}
      <div className="h-11 border-b border-[#d0d7de] dark:border-[#30363d] bg-[#f6f8fa] dark:bg-[#161b22] px-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-[#656d76] dark:text-[#8b949e]">
            Language:
          </span>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={isRunning}
            className="bg-white dark:bg-[#0b0e14] text-[#1f2328] dark:text-[#e6edf3] border border-[#d0d7de] dark:border-[#30363d] rounded px-2 py-0.5 text-xs font-medium focus:outline-none focus:border-[#0969da] dark:focus:border-[#2f81f7] disabled:opacity-50 cursor-pointer"
          >
            <option value="c">C (GCC)</option>
            <option value="python">Python (3.14)</option>
            <option value="java">Java (21)</option>
            <option value="cpp">C++ (23)</option>
            <option value="node">Node.js (22.8)</option>
          </select>

          {statusText && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-[#656d76] dark:text-[#8b949e]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0969da] dark:bg-[#2f81f7] animate-pulse" />
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
              className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#21262d] text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3] text-xs font-medium rounded border border-[#d0d7de] dark:border-[#30363d] transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="px-3 py-1 bg-white dark:bg-[#21262d] text-[#1f2328] dark:text-[#e6edf3] text-xs font-medium rounded border border-[#d0d7de] dark:border-[#30363d] hover:bg-[#f6f8fa] dark:hover:bg-[#30363d] transition-colors disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run code"}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isRunning}
            className="px-3.5 py-1 bg-[#1a7f37] dark:bg-[#238636] hover:opacity-90 text-white text-xs font-medium rounded transition-opacity disabled:opacity-50"
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
