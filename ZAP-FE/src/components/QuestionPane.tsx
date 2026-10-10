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
        return "text-[#1a7f37] dark:text-[#3fb950] bg-[#dafbe1] dark:bg-[#2ea043]/15 border-[#1a7f37]/20 dark:border-[#3fb950]/30";
      case "MEDIUM":
        return "text-[#9a6700] dark:text-[#d29922] bg-[#fff8c5] dark:bg-[#bb8009]/15 border-[#9a6700]/20 dark:border-[#d29922]/30";
      case "HARD":
        return "text-[#cf222e] dark:text-[#f85149] bg-[#ffebe9] dark:bg-[#f85149]/15 border-[#cf222e]/20 dark:border-[#f85149]/30";
      default:
        return "text-[#656d76] dark:text-[#8b949e] bg-[#f6f8fa] dark:bg-[#21262d] border-[#d0d7de] dark:border-[#30363d]";
    }
  };

  const difficultyLabel =
    question.difficulty.charAt(0) + question.difficulty.slice(1).toLowerCase();

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-white dark:bg-[#161b22] border-r border-[#d0d7de] dark:border-[#30363d] p-5 space-y-5 text-[#1f2328] dark:text-[#e6edf3]">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded border ${getBadgeClass(
              question.difficulty
            )}`}
          >
            {difficultyLabel}
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-[#656d76] dark:text-[#8b949e] bg-[#f6f8fa] dark:bg-[#21262d] border border-[#d0d7de] dark:border-[#30363d] px-1.5 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-[#1f2328] dark:text-[#e6edf3]">
          {question.title}
        </h1>
      </div>

      <div className="text-xs leading-relaxed text-[#1f2328] dark:text-[#c9d1d9] whitespace-pre-wrap">
        {question.statement}
      </div>

      {question.examples && question.examples.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-[#656d76] dark:text-[#8b949e]">
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
                className="bg-[#f6f8fa] dark:bg-[#0b0e14] border border-[#d0d7de] dark:border-[#30363d] rounded p-3 space-y-1.5 text-xs font-mono"
              >
                <div className="text-[11px] font-sans font-semibold text-[#0969da] dark:text-[#2f81f7] mb-1">
                  Example {idx + 1}
                </div>
                {exampleImage && (
                  <div className="my-2 flex justify-center bg-white dark:bg-[#161b22] p-2 rounded border border-[#d0d7de] dark:border-[#30363d]">
                    <img
                      src={exampleImage}
                      alt={`Example ${idx + 1} diagram`}
                      className="max-h-52 max-w-full object-contain rounded"
                    />
                  </div>
                )}
                <div>
                  <span className="text-[#8c959f] select-none">
                    Input:{" "}
                  </span>
                  <span>{ex.input}</span>
                </div>
                <div>
                  <span className="text-[#8c959f] select-none">
                    Output:{" "}
                  </span>
                  <span>{ex.output}</span>
                </div>
                {ex.explanation && (
                  <div className="font-sans text-[#656d76] dark:text-[#8b949e] pt-1">
                    <span className="text-[#8c959f] font-mono select-none">
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
          <h2 className="text-xs font-semibold text-[#656d76] dark:text-[#8b949e]">
            Constraints
          </h2>
          <ul className="list-disc list-inside space-y-1 text-xs font-mono text-[#656d76] dark:text-[#8b949e]">
            {question.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
