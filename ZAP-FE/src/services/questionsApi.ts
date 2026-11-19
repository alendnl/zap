import { Question, QuestionFormData, QuestionSummary } from "@/types/question";
import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "")
  || (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

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

export const questionsApi = {
  list: (
    status?: string,
    summary: boolean = true,
    page?: number,
    limit?: number,
    difficulty?: string,
    search?: string
  ): Promise<QuestionSummary[]> => {
    const params = new URLSearchParams();
    if (status && status !== "ALL") params.append("status", status);
    params.append("summary", summary ? "true" : "false");
    if (page) params.append("page", String(page));
    if (limit) params.append("limit", String(limit));
    if (difficulty && difficulty !== "ALL") params.append("difficulty", difficulty);
    if (search && search.trim()) params.append("search", search.trim());
    return apiFetch(`/api/v1/questions?${params.toString()}`);
  },

  get: (id: string, includeHidden: boolean = false): Promise<Question> =>
    apiFetch(`/api/v1/questions/${id}${includeHidden ? "?include_hidden=true" : ""}`),

  create: (data: QuestionFormData): Promise<Question> =>
    apiFetch("/api/v1/questions", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Partial<QuestionFormData>): Promise<Question> =>
    apiFetch(`/api/v1/questions/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  delete: (id: string): Promise<void> =>
    apiFetch(`/api/v1/questions/${id}`, { method: "DELETE" }),
};
