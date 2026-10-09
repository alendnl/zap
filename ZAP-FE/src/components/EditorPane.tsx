"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";

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
  isRunning,
  statusText,
}) => {
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
    <div className="h-full flex flex-col bg-slate-950">
      {/* Editor Header Toolbar */}
      <div className="h-12 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400 select-none">Language:</label>
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={isRunning}
            className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
          >
            <option value="c">C (GCC)</option>
            <option value="python">Python (3.14)</option>
            <option value="java">Java (21)</option>
            <option value="cpp">C++ (23)</option>
            <option value="node">Node.js (22.8)</option>
          </select>

          {statusText && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-xs text-sky-400 border border-slate-700 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              {statusText}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={isRunning}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isRunning ? "Running..." : "Run Code"}
          </button>
          <button
            onClick={onSubmit}
            disabled={isRunning}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-sm transition-colors disabled:opacity-50"
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
          theme="vs-dark"
          value={code}
          onChange={(val) => onCodeChange(val || "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
};
