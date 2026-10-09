import { Student, SignUpData, LoginData, AuthResponse } from "@/types/auth";
import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

const STUDENT_STORAGE_KEY = "zap.student.user";
const TOKEN_STORAGE_KEY = "zap.student.token";
export const AUTH_CHANGE_EVENT = "zap:auth-change";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for this deployment.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(ENVIRONMENT_HEADER, getEnvironment());

  const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail ?? `Auth error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export function getStoredStudent(): Student | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredSession(student: Student, token: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STUDENT_STORAGE_KEY, JSON.stringify(student));
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: student }));
  }
}

export function clearStoredSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STUDENT_STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: null }));
  }
}

export const authApi = {
  signUp: async (data: SignUpData): Promise<AuthResponse> => {
    const res = await apiFetch<AuthResponse>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setStoredSession(res.student, res.token);
    return res;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const res = await apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
    setStoredSession(res.student, res.token);
    return res;
  },

  logout: () => {
    clearStoredSession();
  },
};
