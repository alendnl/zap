"use client";

import React from "react";

export interface QuestionData {
  id: string;
  slug: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  tags: string[];
  statement: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
}

interface QuestionPaneProps {
  question: QuestionData;
}

export const QuestionPane: React.FC<QuestionPaneProps> = ({ question }) => {
  const getBadgeColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "bg-emerald-950/80 text-emerald-400 border-emerald-800";
      case "MEDIUM":
        return "bg-amber-950/80 text-amber-400 border-amber-800";
      case "HARD":
        return "bg-rose-950/80 text-rose-400 border-rose-800";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-slate-900 border-r border-slate-800 p-6 space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getBadgeColor(
              question.difficulty
            )}`}
          >
            {question.difficulty}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-slate-800/80 text-slate-400 border border-slate-700/60 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-100">{question.title}</h1>
      </div>

      <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {question.statement}
      </div>

      {question.examples && question.examples.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Examples
          </h3>
          {question.examples.map((ex, idx) => (
            <div
              key={idx}
              className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2 text-xs"
            >
              <div className="font-mono text-slate-300">
                <span className="text-slate-500 font-semibold select-none">Input: </span>
                {ex.input}
              </div>
              <div className="font-mono text-slate-300">
                <span className="text-slate-500 font-semibold select-none">Output: </span>
                {ex.output}
              </div>
              {ex.explanation && (
                <div className="text-slate-400 italic">
                  <span className="text-slate-500 not-italic font-semibold select-none">
                    Explanation:{" "}
                  </span>
                  {ex.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {question.constraints && question.constraints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
            Constraints
          </h3>
          <ul className="list-disc list-inside space-y-1 text-xs font-mono text-slate-400">
            {question.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
