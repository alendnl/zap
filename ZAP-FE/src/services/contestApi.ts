import {
  Contest,
  ContestSummary,
  ContestFormData,
  ContestStartResponse,
  ContestSubmitRequest,
  ContestSubmitResponse,
  ContestSessionSyncRequest,
  ContestAnalyticsResponse,
  ContestSubmissionsResponse,
  CandidateSubmissionItem,
} from "@/types/contest";
import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

function formatErrorMessage(err: any, status: number): string {
  if (!err) return `API error: ${status}`;
  if (typeof err === "string") return err;
  const detail = err.detail ?? err.message ?? err.error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (item?.loc && item?.msg) {
          const field = item.loc[item.loc.length - 1];
          return `${field ? `${field}: ` : ""}${item.msg}`;
        }
        return item?.msg || JSON.stringify(item);
      })
      .join("; ");
  }
  if (typeof detail === "object" && detail !== null) {
    return detail.message || detail.msg || JSON.stringify(detail);
  }
  return `API error: ${status}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for this deployment.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(ENVIRONMENT_HEADER, getEnvironment());

  if (typeof localStorage !== "undefined") {
    const token = localStorage.getItem("zap.student.token");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    try {
      const studentRaw = localStorage.getItem("zap.student.user");
      if (studentRaw) {
        const student = JSON.parse(studentRaw);
        if (student?.email) headers.set("X-Admin-Email", student.email);
      }
    } catch {}
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatErrorMessage(err, res.status));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const contestApi = {
  list: (status?: string, summary: boolean = true): Promise<ContestSummary[]> => {
    const params = new URLSearchParams();
    if (status && status !== "ALL") params.append("status", status);
    params.append("summary", summary ? "true" : "false");
    return apiFetch(`/api/v1/contests?${params.toString()}`);
  },

  get: (idOrSlug: string): Promise<Contest> =>
    apiFetch(`/api/v1/contests/${encodeURIComponent(idOrSlug)}`),

  create: (data: ContestFormData): Promise<Contest> =>
    apiFetch("/api/v1/contests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<ContestFormData>): Promise<Contest> =>
    apiFetch(`/api/v1/contests/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/v1/contests/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  seedSample: (force: boolean = false): Promise<Contest> =>
    apiFetch(`/api/v1/contests/seed-sample?force=${force ? "true" : "false"}`, {
      method: "POST",
    }),

  start: (
    idOrSlug: string,
    studentId?: string,
    studentEmail?: string,
    studentName?: string
  ): Promise<ContestStartResponse> => {
    const params = new URLSearchParams();
    if (studentId) params.append("student_id", studentId);
    if (studentEmail) params.append("student_email", studentEmail);
    if (studentName) params.append("student_name", studentName);
    return apiFetch(`/api/v1/contests/${encodeURIComponent(idOrSlug)}/start?${params.toString()}`, {
      method: "POST",
    });
  },

  sync: (
    idOrSlug: string,
    payload: ContestSessionSyncRequest
  ): Promise<{
    ok: boolean;
    status: string;
    alreadySubmitted?: boolean;
    timeExpired?: boolean;
    submission?: ContestSubmitResponse;
  }> =>
    apiFetch(`/api/v1/contests/${encodeURIComponent(idOrSlug)}/sync`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submit: (
    idOrSlug: string,
    payload: ContestSubmitRequest
  ): Promise<ContestSubmitResponse> =>
    apiFetch(`/api/v1/contests/${encodeURIComponent(idOrSlug)}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAnalytics: (
    idOrSlug: string,
    page?: number,
    limit?: number,
    search?: string,
    status?: string,
    sortBy?: string,
    includeSubmissions: boolean = false
  ): Promise<ContestAnalyticsResponse> => {
    const params = new URLSearchParams();
    if (page) params.append("page", String(page));
    if (limit) params.append("limit", String(limit));
    if (search && search.trim()) params.append("search", search.trim());
    if (status && status !== "ALL") params.append("status", status);
    if (sortBy) params.append("sort_by", sortBy);
    if (!includeSubmissions) params.append("include_submissions", "false");
    const qs = params.toString();
    return apiFetch(`/api/v1/contests/${encodeURIComponent(idOrSlug)}/analytics${qs ? `?${qs}` : ""}`);
  },

  getSubmissions: (
    idOrSlug: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    status?: string,
    sortBy?: string
  ): Promise<ContestSubmissionsResponse> => {
    const params = new URLSearchParams();
    params.append("page", String(page));
    params.append("limit", String(limit));
    if (search && search.trim()) params.append("search", search.trim());
    if (status && status !== "ALL") params.append("status", status);
    if (sortBy) params.append("sort_by", sortBy);
    const qs = params.toString();
    return apiFetch(`/api/v1/contests/${encodeURIComponent(idOrSlug)}/submissions${qs ? `?${qs}` : ""}`);
  },

  getCandidateSubmission: (
    idOrSlug: string,
    studentIdOrSubId: string
  ): Promise<CandidateSubmissionItem> =>
    apiFetch(
      `/api/v1/contests/${encodeURIComponent(idOrSlug)}/submissions/${encodeURIComponent(studentIdOrSubId)}`
    ),

  resetCandidate: (
    idOrSlug: string,
    studentIdOrSubId: string
  ): Promise<{ ok: boolean; message: string }> =>
    apiFetch(
      `/api/v1/contests/${encodeURIComponent(idOrSlug)}/submissions/${encodeURIComponent(studentIdOrSubId)}`,
      {
        method: "DELETE",
      }
    ),
};
