import {
  Contest,
  ContestSummary,
  ContestFormData,
  ContestStartResponse,
  ContestSubmitRequest,
  ContestSubmitResponse,
  ContestSessionSyncRequest,
} from "@/types/contest";
import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

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
    throw new Error((err as any).detail ?? `API error: ${res.status}`);
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
    apiFetch(`/api/v1/contests/${idOrSlug}`),

  create: (data: ContestFormData): Promise<Contest> =>
    apiFetch("/api/v1/contests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<ContestFormData>): Promise<Contest> =>
    apiFetch(`/api/v1/contests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/v1/contests/${id}`, {
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
    return apiFetch(`/api/v1/contests/${idOrSlug}/start?${params.toString()}`, {
      method: "POST",
    });
  },

  sync: (
    idOrSlug: string,
    payload: ContestSessionSyncRequest
  ): Promise<{ ok: boolean; status: string }> =>
    apiFetch(`/api/v1/contests/${idOrSlug}/sync`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submit: (
    idOrSlug: string,
    payload: ContestSubmitRequest
  ): Promise<ContestSubmitResponse> =>
    apiFetch(`/api/v1/contests/${idOrSlug}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
