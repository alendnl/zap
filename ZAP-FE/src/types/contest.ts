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

export interface ProctoringViolation {
  type: "TAB_SWITCH" | "COPY_PASTE" | "FULLSCREEN_EXIT" | string;
  timestamp: string;
  details?: string;
}

export interface ProctoringTelemetry {
  tabSwitchCount: number;
  copyPasteAttempts: number;
  fullscreenExitCount: number;
  violationsLog: ProctoringViolation[];
}

export interface CodingProblemState {
  code: Record<string, string>; // language -> code
  lastLanguage: string;
  status: "UNATTEMPTED" | "ATTEMPTED" | "SUBMITTED" | "ACCEPTED" | string;
  bestVerdict?: string;
  lastSubmissionId?: string;
  passedTestCases?: number;
  totalTestCases?: number;
  passPercentage?: number;
}

export interface ContestStartResponse {
  contest: Contest;
  mcqQuestions: ContestMCQQuestion[];
  codingQuestions: ContestCodingQuestion[];
  startedAt: string;
  sessionId: string;
  alreadySubmitted?: boolean;
  submission?: ContestSubmitResponse | null;
  mcqAnswers?: Record<string, string>;
  reviewedQuestionIds?: string[];
  codingState?: Record<string, CodingProblemState>;
  proctoring?: ProctoringTelemetry;
  timeSpentSeconds?: number;
}

export interface ContestSessionSyncRequest {
  studentId: string;
  studentEmail?: string;
  studentName?: string;
  mcqAnswers?: Record<string, string>;
  reviewedQuestionIds?: string[];
  codingState?: Record<string, CodingProblemState>;
  proctoring?: ProctoringTelemetry;
  timeSpentSeconds?: number;
}

export interface ContestSubmitRequest {
  studentId: string;
  studentEmail: string;
  studentName?: string;
  mcqAnswers: Record<string, string>; // questionId -> selectedOptionId
  codingSubmissions?: Record<string, string>; // questionId -> submissionId
  codingState?: Record<string, CodingProblemState>;
  proctoring?: ProctoringTelemetry;
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
  passedTestCases?: number;
  totalTestCases?: number;
  percentage?: number;
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
  mcqPercentage?: number;
  codingScore: number;
  maxCodingScore: number;
  codingProblemsAttempted: number;
  codingTotalCount: number;
  percentage: number;
  timeSpentSeconds: number;
  submittedAt: string;
  mcqBreakdown: MCQReviewItem[];
  codingBreakdown: CodingReviewItem[];
  proctoring?: ProctoringTelemetry;
  codingState?: Record<string, any>;
}

export interface ScoreBucket {
  range: string;
  count: number;
  percentage: number;
}

export interface QuestionAccuracyStat {
  questionId: string;
  title: string;
  category: string;
  difficulty: string;
  totalAttempts: number;
  correctCount: number;
  accuracyRate: number;
}

export interface ProblemAcceptanceStat {
  questionId: string;
  title: string;
  difficulty: string;
  attemptedCount: number;
  acceptedCount: number;
  acceptanceRate: number;
  languagesUsed: Record<string, number>;
}

export interface ProctoringSummaryStats {
  totalTabSwitches: number;
  totalCopyPasteAttempts: number;
  totalFullscreenExits: number;
  totalInfractions: number;
  cleanCandidatesCount: number;
  flaggedCandidatesCount: number;
  highRiskCandidatesCount: number;
  cleanRate: number;
}

export interface CandidateSubmissionItem {
  id: string;
  submissionId?: string;
  contestId: string;
  studentId: string;
  studentEmail: string;
  studentName?: string;
  status: "SUBMITTED" | "IN_PROGRESS" | string;
  startedAt?: string;
  submittedAt?: string;
  updatedAt?: string;
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  mcqScore: number;
  maxMcqScore?: number;
  mcqCorrectCount: number;
  mcqTotalCount: number;
  codingScore: number;
  maxCodingScore?: number;
  codingProblemsAttempted: number;
  codingTotalCount: number;
  timeSpentSeconds: number;
  proctoring?: ProctoringTelemetry;
  mcqAnswers?: Record<string, string>;
  mcqBreakdown?: MCQReviewItem[];
  codingBreakdown?: CodingReviewItem[];
  codingState?: Record<string, CodingProblemState>;
}

export interface ContestAnalyticsResponse {
  contest: ContestSummary;
  totalCandidates: number;
  completedCount: number;
  inProgressCount: number;
  completionRate: number;
  averageScore: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  averagePercentage: number;
  averageTimeSpentSeconds: number;
  scoreDistribution: ScoreBucket[];
  mcqStats: {
    totalQuestions: number;
    questions: Array<{
      questionId: string;
      title: string;
      category: string;
      difficulty: string;
      totalAttempts: number;
      correctCount: number;
      accuracyRate: number;
    }>;
  };
  codingStats: {
    totalProblems: number;
    problems: ProblemAcceptanceStat[];
  };
  proctoringStats: ProctoringSummaryStats;
  submissions: CandidateSubmissionItem[];
  totalSubmissions?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface ContestSubmissionsResponse {
  submissions: CandidateSubmissionItem[];
  totalSubmissions: number;
  page: number;
  limit: number;
  totalPages: number;
}

