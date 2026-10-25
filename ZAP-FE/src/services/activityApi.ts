import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

export interface ProblemActivitySummary {
  status: "ATTEMPTED" | "SOLVED";
  attemptsCount: number;
  submitsCount: number;
  runsCount: number;
  bestVerdict?: string | null;
  latestSubmissionId?: string | null;
  latestVerdict?: string | null;
  firstAttemptedAt: string;
  lastAttemptedAt: string;
  solvedAt?: string | null;
}

export interface SubmissionActivityBrief {
  submissionId: string;
  questionId: string;
  language: string;
  mode: string;
  status: string;
  verdict?: string | null;
  createdAt: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  totalSolved: number;
  totalAttempted: number;
  solvedQuestionIds: string[];
  attemptedQuestionIds: string[];
  problems: Record<string, ProblemActivitySummary>;
  recentSubmissions: SubmissionActivityBrief[];
  createdAt: string;
  updatedAt: string;
}

export interface UserActivitySummary {
  userId: string;
  totalSolved: number;
  totalAttempted: number;
  solvedQuestionIds: string[];
  attemptedQuestionIds: string[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for this deployment.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(ENVIRONMENT_HEADER, getEnvironment());

  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail ?? `API error: ${res.status}`);
  }

  return res.json();
}

export const activityApi = {
  getSummary: (userId: string): Promise<UserActivitySummary> =>
    apiFetch(`/api/v1/users/${encodeURIComponent(userId)}/activity/summary`),

  getActivity: (userId: string): Promise<UserActivity> =>
    apiFetch(`/api/v1/users/${encodeURIComponent(userId)}/activity`),
};
