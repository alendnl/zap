import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

const TOKEN_STORAGE_KEY = "zap.student.token";

export interface SolvedDifficultyBreakdown {
  easy: number;
  medium: number;
  hard: number;
}

export interface UserAdminStats {
  id: string;
  name: string;
  email: string;
  studentId: string;
  collegeName: string;
  createdAt: string;
  totalSolved: number;
  totalAttempted: number;
  totalSubmissions: number;
  accuracyRate: number;
  solvedBreakdown: SolvedDifficultyBreakdown;
  lastActiveAt?: string | null;
}

export interface CollegeMetric {
  collegeName: string;
  studentCount: number;
  totalSolved: number;
}

export interface AdminUsersOverview {
  totalStudents: number;
  totalColleges: number;
  totalSolvedQuestions: number;
  totalSubmissions: number;
  topColleges: CollegeMetric[];
}

export interface AdminUsersResponse {
  overview: AdminUsersOverview;
  users: UserAdminStats[];
  colleges: string[];
}

export interface SolvedQuestionBrief {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  solvedAt?: string | null;
}

export interface UserDetailActivityResponse {
  id: string;
  name: string;
  email: string;
  studentId: string;
  collegeName: string;
  createdAt: string;
  totalSolved: number;
  totalAttempted: number;
  totalSubmissions: number;
  accuracyRate: number;
  solvedBreakdown: SolvedDifficultyBreakdown;
  solvedQuestions: SolvedQuestionBrief[];
  recentSubmissions: Array<{
    id: string;
    questionId: string;
    language: string;
    mode: string;
    status: string;
    verdict?: string | null;
    createdAt: string;
  }>;
}

async function adminFetch<T>(path: string, adminEmail: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set(ENVIRONMENT_HEADER, getEnvironment());
  headers.set("X-Admin-Email", adminEmail);

  const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error((err as any).detail ?? `Admin API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const adminApi = {
  checkAdmin: async (email: string): Promise<boolean> => {
    if (!email) return false;
    try {
      const res = await adminFetch<{ isAdmin: boolean; email: string }>(
        `/api/v1/admin/check-access?email=${encodeURIComponent(email)}`,
        email
      );
      return Boolean(res?.isAdmin);
    } catch {
      return false;
    }
  },

  getUsersDashboard: async (
    email: string,
    college?: string,
    search?: string
  ): Promise<AdminUsersResponse> => {
    const params = new URLSearchParams({ email });
    if (college && college !== "ALL") params.set("college", college);
    if (search && search.trim()) params.set("search", search.trim());

    return adminFetch<AdminUsersResponse>(`/api/v1/admin/users?${params.toString()}`, email);
  },

  getUserDetails: async (email: string, userId: string): Promise<UserDetailActivityResponse> => {
    const params = new URLSearchParams({ email });
    return adminFetch<UserDetailActivityResponse>(
      `/api/v1/admin/users/${encodeURIComponent(userId)}?${params.toString()}`,
      email
    );
  },

  exportUsersCsv: (users: UserAdminStats[], collegeFilter?: string): void => {
    if (!users || users.length === 0) return;

    const headers = [
      "Student ID",
      "Name",
      "Email",
      "College",
      "Total Solved",
      "Easy Solved",
      "Medium Solved",
      "Hard Solved",
      "Total Attempted",
      "Total Submissions",
      "Accuracy Rate (%)",
      "Joined At",
      "Last Active At",
    ];

    const rows = users.map((u) => [
      `"${(u.studentId || "").replace(/"/g, '""')}"`,
      `"${(u.name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${(u.collegeName || "").replace(/"/g, '""')}"`,
      u.totalSolved,
      u.solvedBreakdown?.easy ?? 0,
      u.solvedBreakdown?.medium ?? 0,
      u.solvedBreakdown?.hard ?? 0,
      u.totalAttempted,
      u.totalSubmissions,
      `${u.accuracyRate}%`,
      `"${u.createdAt || ""}"`,
      `"${u.lastActiveAt || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    const suffix = collegeFilter && collegeFilter !== "ALL" ? `_${collegeFilter.replace(/\s+/g, "_")}` : "";
    link.setAttribute("href", url);
    link.setAttribute("download", `zap_users_report${suffix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
