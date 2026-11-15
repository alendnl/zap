// ZAP Faculty — Shared Question types (mirrors ZAP-BE schema)
export type Difficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type TestCaseVisibility = "PUBLIC" | "HIDDEN";

export interface TestCase {
  id: string;
  visibility: TestCaseVisibility;
  input: string;
  expectedOutput: string;
  enabled: boolean;
}

export interface ExecutionLimits {
  timeMs: number;
  memoryMb: number;
  outputKb: number;
}

export interface Question {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  statement: string;
  examples?: Array<{
    input: string;
    output: string;
    explanation?: string;
    image?: string;
  }>;
  constraints: string[];
  testCases: TestCase[];
  executionLimits: ExecutionLimits;
  supportedLanguages: string[];
  starterCode?: Record<string, string>;
  status: QuestionStatus;
  version: number;
}

export interface QuestionSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  status: QuestionStatus;
  version: number;
  testCasesCount?: number;
  supportedLanguages?: string[];
}

export type QuestionFormData = Omit<Question, "id" | "version">;

export const DEFAULT_STARTER_CODE: Record<string, string> = {
  python: `class Solution:
    def solution(self):
        # Write your solution here
        pass
`,
  c: `#include <stdio.h>
#include <stdlib.h>

// Write your solution here
`,
  cpp: `class Solution {
public:
    void solution() {
        // Write your solution here
    }
};
`,
  java: `class Solution {
    public void solution() {
        // Write your solution here
    }
}
`,
  node: `/**
 * @return {void}
 */
var solution = function() {
    // Write your solution here
};
`,
};

export const EMPTY_QUESTION_FORM: QuestionFormData = {
  slug: "",
  title: "",
  difficulty: "EASY",
  tags: [],
  statement: "",
  constraints: [],
  testCases: [
    {
      id: "tc-1",
      visibility: "PUBLIC",
      input: "",
      expectedOutput: "",
      enabled: true,
    },
  ],
  executionLimits: { timeMs: 2000, memoryMb: 256, outputKb: 1024 },
  supportedLanguages: ["python", "c", "cpp", "java", "node"],
  starterCode: DEFAULT_STARTER_CODE,
  status: "PUBLISHED",
};


