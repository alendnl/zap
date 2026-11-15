import { Difficulty } from "./mcq";

export type ContestStatus = "PUBLISHED" | "DRAFT" | "ARCHIVED";
export type SelectionMode = "MANUAL" | "RANDOM";

export interface MCQRandomRule {
  category: string;
  difficulty: string;
  count: number;
}

export interface CodingRandomRule {
  difficulty: string;
  tag: string;
  count: number;
}

export interface MCQSectionConfig {
  enabled: boolean;
  mode: SelectionMode;
  questionIds: string[];
  randomRules: MCQRandomRule[];
  totalQuestions: number;
  pointsPerQuestion: number;
}

export interface CodingSectionConfig {
  enabled: boolean;
  mode: SelectionMode;
  questionIds: string[];
  randomRules: CodingRandomRule[];
  totalQuestions: number;
  pointsPerQuestion: number;
}

export interface Contest {
  id: string;
  title: string;
  slug: string;
  description: string;
  durationMinutes: number;
  hasMcq: boolean;
  hasCoding: boolean;
  mcqConfig?: MCQSectionConfig;
  codingConfig?: CodingSectionConfig;
  status: ContestStatus;
  totalPoints: number;
  startTime?: string;
  endTime?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContestSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  durationMinutes: number;
  hasMcq: boolean;
  hasCoding: boolean;
  mcqQuestionsCount: number;
  codingQuestionsCount: number;
  totalPoints: number;
  status: ContestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContestFormData {
  title: string;
  slug: string;
  description: string;
  durationMinutes: number;
  hasMcq: boolean;
  hasCoding: boolean;
  mcqConfig: MCQSectionConfig;
  codingConfig: CodingSectionConfig;
  status: ContestStatus;
  totalPoints: number;
}

export interface MaskedMCQOption {
  id: string;
  type: string;
  text?: string;
  code?: string;
  codeLanguage?: string;
  imageUrl?: string;
}

export interface ContestMCQQuestion {
  id: string;
  title: string;
  slug?: string;
  category: string;
  difficulty: Difficulty;
  tags: string[];
  questionType: string;
  statement: string;
  codeSnippet?: string;
  codeLanguage?: string;
  imageUrl?: string;
  options: MaskedMCQOption[];
  points: number;
}

export interface ContestCodingQuestion {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  statement: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  constraints: string[];
  starterCode?: Record<string, string>;
  points: number;
}

export interface ContestStartResponse {
  contest: Contest;
  mcqQuestions: ContestMCQQuestion[];
  codingQuestions: ContestCodingQuestion[];
  startedAt: string;
  sessionId: string;
}

export interface ContestSubmitRequest {
  studentId: string;
  studentEmail: string;
  studentName?: string;
  mcqAnswers: Record<string, string>; // questionId -> selectedOptionId
  codingSubmissions?: Record<string, string>; // questionId -> submissionId
  timeSpentSeconds: number;
}

export interface MCQReviewItem {
  questionId: string;
  title: string;
  category: string;
  difficulty: string;
  statement: string;
  selectedOptionId?: string;
  correctOptionId: string;
  isCorrect: boolean;
  pointsAwarded: number;
  explanation?: string;
  options: Array<{
    id: string;
    type: string;
    text?: string;
    code?: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
}

export interface CodingReviewItem {
  questionId: string;
  title: string;
  difficulty: string;
  submissionId?: string;
  status: string;
  score: number;
}

export interface ContestSubmitResponse {
  submissionId: string;
  contestId: string;
  studentId: string;
  studentEmail: string;
  totalScore: number;
  maxTotalScore: number;
  mcqScore: number;
  maxMcqScore: number;
  mcqCorrectCount: number;
  mcqTotalCount: number;
  codingScore: number;
  maxCodingScore: number;
  codingProblemsAttempted: number;
  codingTotalCount: number;
  percentage: number;
  timeSpentSeconds: number;
  submittedAt: string;
  mcqBreakdown: MCQReviewItem[];
  codingBreakdown: CodingReviewItem[];
}
