import { Question, QuestionFormData, QuestionSummary } from "@/types/question";
import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
  || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for this deployment.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(ENVIRONMENT_HEADER, getEnvironment());

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

export const questionsApi = {
  list: (status?: string, summary: boolean = true): Promise<QuestionSummary[]> => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("summary", summary ? "true" : "false");
    return apiFetch(`/api/v1/questions?${params.toString()}`);
  },

  get: (id: string): Promise<Question> =>
    apiFetch(`/api/v1/questions/${id}`),

  create: (data: QuestionFormData): Promise<Question> =>
    apiFetch("/api/v1/questions", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<QuestionFormData>): Promise<Question> =>
    apiFetch(`/api/v1/questions/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/v1/questions/${id}`, { method: "DELETE" }),
};
