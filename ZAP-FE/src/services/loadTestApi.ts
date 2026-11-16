import { ENVIRONMENT_HEADER } from "./environment";
import { LoadTestRunReport, UnifiedLoadTestConfig } from "@/lib/load-test/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

const TOKEN_STORAGE_KEY = "zap.student.token";

export interface SavedLoadTestConfig {
  id: string;
  name: string;
  description?: string;
  targetService: "api" | "executor";
  config: UnifiedLoadTestConfig;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LowerDataStats {
  database: string;
  syntheticUsersCount: number;
  totalUsersCount: number;
  syntheticSubmissionsCount: number;
  totalSubmissionsCount: number;
  userActivitiesCount: number;
  savedConfigsCount: number;
  savedRunsCount: number;
}

export interface CleanLowerDataResult {
  success: boolean;
  database: string;
  deletedUsers: number;
  deletedSubmissions: number;
  deletedActivities: number;
  message: string;
}

async function loadTestFetch<T>(path: string, adminEmail: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // Strict Guardrail: Always point to QA environment for load test management
  headers.set(ENVIRONMENT_HEADER, "qa");
  headers.set("X-Admin-Email", adminEmail);

  const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail ?? `Load Test API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const loadTestApi = {
  // Configs
  listConfigs: async (adminEmail: string): Promise<SavedLoadTestConfig[]> => {
    return loadTestFetch<SavedLoadTestConfig[]>("/api/v1/admin/load-test/configs", adminEmail);
  },

  createConfig: async (
    adminEmail: string,
    payload: { name: string; description?: string; targetService: "api" | "executor"; config: UnifiedLoadTestConfig }
  ): Promise<SavedLoadTestConfig> => {
    return loadTestFetch<SavedLoadTestConfig>("/api/v1/admin/load-test/configs", adminEmail, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteConfig: async (adminEmail: string, configId: string): Promise<{ success: boolean }> => {
    return loadTestFetch<{ success: boolean }>(`/api/v1/admin/load-test/configs/${encodeURIComponent(configId)}`, adminEmail, {
      method: "DELETE",
    });
  },

  // Historical Runs
  listRuns: async (adminEmail: string, limit = 50, skip = 0): Promise<LoadTestRunReport[]> => {
    const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    return loadTestFetch<LoadTestRunReport[]>(`/api/v1/admin/load-test/runs?${params.toString()}`, adminEmail);
  },

  recordRun: async (adminEmail: string, payload: any): Promise<LoadTestRunReport> => {
    return loadTestFetch<LoadTestRunReport>("/api/v1/admin/load-test/runs", adminEmail, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  deleteRun: async (adminEmail: string, runId: string): Promise<{ success: boolean }> => {
    return loadTestFetch<{ success: boolean }>(`/api/v1/admin/load-test/runs/${encodeURIComponent(runId)}`, adminEmail, {
      method: "DELETE",
    });
  },

  // QA Data stats & cleanup
  getDataStats: async (adminEmail: string): Promise<LowerDataStats> => {
    return loadTestFetch<LowerDataStats>("/api/v1/admin/load-test/data-stats", adminEmail);
  },

  cleanLowerData: async (
    adminEmail: string,
    target: "synthetic" | "all_test_data",
    confirmation: string
  ): Promise<CleanLowerDataResult> => {
    return loadTestFetch<CleanLowerDataResult>("/api/v1/admin/load-test/clean-data", adminEmail, {
      method: "POST",
      body: JSON.stringify({ target, confirmation }),
    });
  },
};
