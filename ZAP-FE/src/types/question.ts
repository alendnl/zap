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

