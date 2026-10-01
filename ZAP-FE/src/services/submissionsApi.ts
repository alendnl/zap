// ZAP Submission API client — wired to ZAP-BE ISSUE-001 endpoints
export type SubmissionStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type SubmissionVerdict =
  | "ACCEPTED"
  | "WRONG_ANSWER"
  | "COMPILE_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "SYSTEM_ERROR"
  | "CANCELLED";

export type SubmissionMode = "RUN" | "SUBMIT";

export interface SubmissionCreateRequest {
  questionId: string;
  language: string;
  mode: SubmissionMode;
  sourceCode: string;
  userId?: string;
}

export interface SubmissionCreateResponse {
  submissionId: string;
  status: SubmissionStatus;
}

export interface SubmissionTestsSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface Submission {
  id: string;
  userId: string;
  questionId: string;
  language: string;
  mode: SubmissionMode;
  status: SubmissionStatus;
  verdict?: SubmissionVerdict;
  executionTimeMs?: number;
  memoryUsedBytes?: number;
  tests: SubmissionTestsSummary;
  compileOutput?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail ?? `API error: ${res.status}`);
  }
  return res.json();
}

export const submissionsApi = {
  create: (req: SubmissionCreateRequest): Promise<SubmissionCreateResponse> =>
    apiFetch("/api/v1/submissions", { method: "POST", body: JSON.stringify(req) }),

  get: (submissionId: string): Promise<Submission> =>
    apiFetch(`/api/v1/submissions/${submissionId}`),
};

/** TERMINAL statuses — polling should stop when the submission reaches one of these. */
export const TERMINAL_STATUSES: SubmissionStatus[] = ["COMPLETED", "FAILED"];

export function isTerminalStatus(status: SubmissionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
