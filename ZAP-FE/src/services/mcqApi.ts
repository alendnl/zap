import { MCQQuestion, MCQFormData, MCQQuestionSummary } from "@/types/mcq";
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

export const mcqApi = {
  list: (
    category?: string,
    difficulty?: string,
    status?: string,
    search?: string,
    summary: boolean = true
  ): Promise<MCQQuestionSummary[]> => {
    const params = new URLSearchParams();
    if (category && category !== "ALL") params.append("category", category);
    if (difficulty && difficulty !== "ALL") params.append("difficulty", difficulty);
    if (status && status !== "ALL") params.append("status", status);
    if (search && search.trim()) params.append("search", search.trim());
    params.append("summary", summary ? "true" : "false");
    return apiFetch(`/api/v1/mcq/questions?${params.toString()}`);
  },

  get: (id: string): Promise<MCQQuestion> =>
    apiFetch(`/api/v1/mcq/questions/${id}`),

  create: (data: MCQFormData): Promise<MCQQuestion> =>
    apiFetch("/api/v1/mcq/questions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<MCQFormData>): Promise<MCQQuestion> =>
    apiFetch(`/api/v1/mcq/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/v1/mcq/questions/${id}`, {
      method: "DELETE",
    }),

  seed: (force: boolean = false): Promise<{ status: string; seeded: number; total: number }> =>
    apiFetch(`/api/v1/mcq/seed?force=${force ? "true" : "false"}`, {
      method: "POST",
    }),
};

