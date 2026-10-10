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
    image?: string;
  }>;
  constraints: string[];
  starterCode?: Record<string, string>;
}


interface QuestionPaneProps {
  question: QuestionData;
}

export const QuestionPane: React.FC<QuestionPaneProps> = ({ question }) => {
  const getBadgeColor = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "MEDIUM":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "HARD":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 p-6 space-y-6">
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
                className="text-xs bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{question.title}</h1>
      </div>

      <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
        {question.statement}
      </div>

      {question.examples && question.examples.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            Examples
          </h3>
          {question.examples.map((ex, idx) => {
            const exampleImage =
              ex.image ||
              (question.slug === "binary-tree-maximum-path-sum"
                ? idx === 0
                  ? "/images/binary-tree-max-path-1.jpg"
                  : idx === 1
                  ? "/images/binary-tree-max-path-2.jpg"
                  : undefined
                : undefined);

            return (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 space-y-2 text-xs"
              >
                <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 mb-1 uppercase tracking-wider">
                  Example {idx + 1}:
                </div>
                {exampleImage && (
                  <div className="my-2.5 flex justify-center bg-white dark:bg-slate-900/80 p-2 rounded border border-slate-200 dark:border-slate-800">
                    <img
                      src={exampleImage}
                      alt={`Example ${idx + 1} diagram`}
                      className="max-h-56 max-w-full object-contain rounded"
                    />
                  </div>
                )}
                <div className="font-mono text-slate-800 dark:text-slate-200">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold select-none">
                    Input:{" "}
                  </span>
                  {ex.input}
                </div>
                <div className="font-mono text-slate-800 dark:text-slate-200">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold select-none">
                    Output:{" "}
                  </span>
                  {ex.output}
                </div>
                {ex.explanation && (
                  <div className="text-slate-600 dark:text-slate-400 italic">
                    <span className="text-slate-400 dark:text-slate-500 not-italic font-semibold select-none">
                      Explanation:{" "}
                    </span>
                    {ex.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {question.constraints && question.constraints.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            Constraints
          </h3>
          <ul className="list-disc list-inside space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
            {question.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
