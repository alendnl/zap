// Faculty Question API client — wired to ZAP-BE REST endpoints (ISSUE-005)
import { Question, QuestionFormData } from "@/types/question";
import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  list: (status?: string): Promise<Question[]> =>
    apiFetch(`/api/v1/questions${status ? `?status=${status}` : ""}`),

  get: (id: string): Promise<Question> =>
    apiFetch(`/api/v1/questions/${id}`),

  create: (data: QuestionFormData): Promise<Question> =>
    apiFetch("/api/v1/questions", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<QuestionFormData>): Promise<Question> =>
    apiFetch(`/api/v1/questions/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/v1/questions/${id}`, { method: "DELETE" }),
};
