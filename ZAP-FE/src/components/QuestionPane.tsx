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
  const getBadgeClass = (difficulty: string) => {
    switch (difficulty) {
      case "EASY":
        return "text-[#047857] dark:text-[#34d399] bg-[#ecfdf5] dark:bg-[#10b981]/15 border-[#a7f3d0] dark:border-[#10b981]/25";
      case "MEDIUM":
        return "text-[#b45309] dark:text-[#fbbf24] bg-[#fffbeb] dark:bg-[#f59e0b]/15 border-[#fde68a] dark:border-[#f59e0b]/25";
      case "HARD":
        return "text-[#b91c1c] dark:text-[#fb7185] bg-[#fef2f2] dark:bg-[#f43f5e]/15 border-[#fecaca] dark:border-[#f43f5e]/25";
      default:
        return "text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#1a2233] border-[#e2e8f0] dark:border-[#232f45]";
    }
  };

  const difficultyLabel =
    question.difficulty.charAt(0) + question.difficulty.slice(1).toLowerCase();

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white dark:bg-[#121824] border-r border-[#e2e8f0] dark:border-[#1e293b] p-5 space-y-5 text-[#0f172a] dark:text-[#f8fafc] transition-colors">
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getBadgeClass(
              question.difficulty
            )}`}
          >
            {difficultyLabel}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-[#64748b] dark:text-[#94a3b8] bg-[#f1f5f9] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#0f172a] dark:text-white">
          {question.title}
        </h1>
      </div>

      <div className="text-xs leading-relaxed text-[#334155] dark:text-[#cbd5e1] whitespace-pre-wrap">
        {question.statement}
      </div>

      {question.examples && question.examples.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
            Examples
          </h2>
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
                className="bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl p-3.5 space-y-2 text-xs font-mono shadow-xs"
              >
                <div className="text-[11px] font-sans font-bold text-blue-600 dark:text-blue-400">
                  Example {idx + 1}
                </div>
                {exampleImage && (
                  <div className="my-2 flex justify-center bg-white dark:bg-[#121824] p-2 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b]">
                    <img
                      src={exampleImage}
                      alt={`Example ${idx + 1} diagram`}
                      className="max-h-52 max-w-full object-contain rounded"
                    />
                  </div>
                )}
                <div>
                  <span className="text-[#94a3b8] select-none">
                    Input:{" "}
                  </span>
                  <span className="text-[#0f172a] dark:text-[#f8fafc]">{ex.input}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8] select-none">
                    Output:{" "}
                  </span>
                  <span className="text-[#0f172a] dark:text-[#f8fafc]">{ex.output}</span>
                </div>
                {ex.explanation && (
                  <div className="font-sans text-[#64748b] dark:text-[#94a3b8] pt-1">
                    <span className="text-[#94a3b8] font-mono select-none">
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
          <h2 className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
            Constraints
          </h2>
          <ul className="list-disc list-inside space-y-1 text-xs font-mono text-[#64748b] dark:text-[#94a3b8]">
            {question.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
