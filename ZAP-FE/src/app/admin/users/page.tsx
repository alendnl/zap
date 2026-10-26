"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  X,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Calendar,
  Award,
  Layers,
  Code2,
  Terminal,
  Activity,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { getStoredStudent, AUTH_CHANGE_EVENT } from "@/services/authApi";
import { adminApi, UserAdminStats, AdminUsersOverview, UserDetailActivityResponse } from "@/services/adminApi";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Student } from "@/types/auth";

type SortOption = "solved_desc" | "accuracy_desc" | "name_asc" | "recent_joined";

export default function AdminUsersDashboardPage() {
  const router = useRouter();

  // Current session & auth
  const [student, setStudent] = useState<Student | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Dashboard state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminUsersOverview | null>(null);
  const [users, setUsers] = useState<UserAdminStats[]>([]);
  const [collegesList, setCollegesList] = useState<string[]>([]);

  // Filters & sorting
  const [selectedCollege, setSelectedCollege] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("solved_desc");

  // User detail drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetailActivityResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Verify auth & admin access
  useEffect(() => {
    const currentStudent = getStoredStudent();
    setStudent(currentStudent);
    if (!currentStudent?.email) {
      setAuthChecking(false);
      setIsAdmin(false);
      return;
    }

    let isMounted = true;
    adminApi
      .checkAdmin(currentStudent.email)
      .then((allowed) => {
        if (!isMounted) return;
        setIsAdmin(allowed);
        setAuthChecking(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsAdmin(false);
        setAuthChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (!student?.email || !isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getUsersDashboard(
        student.email,
        selectedCollege === "ALL" ? undefined : selectedCollege,
        searchQuery.trim() ? searchQuery.trim() : undefined
      );
      setOverview(data.overview);
      setUsers(data.users || []);
      setCollegesList(data.colleges || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load dashboard metrics. Verify database connectivity."
      );
    } finally {
      setLoading(false);
    }
  }, [student?.email, isAdmin, selectedCollege, searchQuery]);

  useEffect(() => {
    if (isAdmin) {
      void fetchDashboardData();
    }
  }, [isAdmin, fetchDashboardData]);

  // Load single user detail for drawer
  const openUserDetail = async (userId: string) => {
    if (!student?.email) return;
    setSelectedUserId(userId);
    setLoadingDetail(true);
    setUserDetail(null);
    try {
      const detail = await adminApi.getUserDetails(student.email, userId);
      setUserDetail(detail);
    } catch (err: unknown) {
      console.error("Failed to load user details", err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeUserDetail = () => {
    setSelectedUserId(null);
    setUserDetail(null);
  };

  // Client-side sorting
  const sortedUsers = useMemo(() => {
    const list = [...users];
    switch (sortBy) {
      case "solved_desc":
        return list.sort((a, b) => b.totalSolved - a.totalSolved || b.accuracyRate - a.accuracyRate);
      case "accuracy_desc":
        return list.sort((a, b) => b.accuracyRate - a.accuracyRate || b.totalSolved - a.totalSolved);
      case "name_asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "recent_joined":
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      default:
        return list;
    }
  }, [users, sortBy]);

  // College count mapping
  const collegeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach((u) => {
      const c = u.collegeName || "Unassigned";
      map[c] = (map[c] || 0) + 1;
    });
    return map;
  }, [users]);

  // Format date helper
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "Never";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  // Format relative time helper
  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return "No activity yet";
    try {
      const now = Date.now();
      const past = new Date(isoString).getTime();
      const diffMs = now - past;
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return formatDate(isoString);
    } catch {
      return isoString;
    }
  };

  // 1. Loading Auth State
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
          <p className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
            Verifying administrative access permissions...
          </p>
        </div>
      </div>
    );
  }

  // 2. Not Logged In
  if (!student) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-white mb-2">
            Authentication Required
          </h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-6 leading-relaxed">
            Please log in with an administrator account to view the Users Dashboard and candidate performance metrics.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // 3. Logged in but not in Admin Collection
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#121824] border border-rose-200 dark:border-rose-900/40 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-white mb-2">
            Admin Access Restricted
          </h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-3 leading-relaxed">
            The account <strong className="text-[#0f172a] dark:text-white font-mono">{student.email}</strong> is not listed in the platform administrator collection.
          </p>
          <p className="text-[11px] text-[#94a3b8] mb-6">
            If you need administrative privileges, please request access from the system administrator.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#1e293b] hover:bg-[#e2e8f0] dark:hover:bg-[#283548] text-[#0f172a] dark:text-white font-semibold text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-2" />
            Back to Arena
          </Link>
        </div>
      </div>
    );
  }

  // 4. Authorized Admin User Dashboard
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md flex-shrink-0 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand & Admin Navigation */}
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shadow-blue-600/30">
                Z
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight select-none text-[#0f172a] dark:text-white">
                  ZAP
                </span>
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Admin
                </span>
              </div>
            </Link>

            {/* Admin Segmented Subnavigation */}
            <nav className="hidden sm:flex items-center gap-1 bg-[#f1f5f9] dark:bg-[#0b0f17] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]">
                <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Users Dashboard</span>
                {overview?.totalStudents ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                    {overview.totalStudents}
                  </span>
                ) : null}
              </div>

              <Link
                href="/faculty/questions"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white transition-colors"
                title="Manage Questions & Test Cases"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Questions Manager</span>
              </Link>
            </nav>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#1a2233] hover:bg-[#f1f5f9] dark:hover:bg-[#232f45] text-xs font-medium text-[#475569] dark:text-[#cbd5e1] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Return to Arena</span>
            </Link>

            <div className="hidden lg:flex items-center gap-1.5 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs">
              <span className="w-4 h-4 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white truncate max-w-[130px]">
                {student.name}
              </span>
            </div>

            <EnvironmentSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col gap-6">
        {/* Page Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0f172a] dark:text-white">
                Student Performance & Cohort Analytics
              </h1>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Live Data
              </span>
            </div>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Monitor question completion metrics, institutional representation, and individual problem-solving velocity.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void fetchDashboardData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] text-xs font-medium text-[#475569] dark:text-[#cbd5e1] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Refresh data from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => adminApi.exportUsersCsv(sortedUsers, selectedCollege)}
              disabled={loading || sortedUsers.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              title="Export filtered records as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Download CSV Report</span>
            </button>
          </div>
        </div>

        {/* Error Banner if any */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between text-xs text-rose-700 dark:text-rose-400">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchDashboardData()}
              className="underline font-semibold ml-4 hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Overview Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Card 1: Total Registered Students */}
          <div className="p-4 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
                Registered Students
              </span>
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
              {loading && !overview ? "..." : overview?.totalStudents ?? 0}
            </div>
            <div className="mt-1 text-[10px] text-[#94a3b8]">Active platform accounts</div>
          </div>

          {/* Card 2: Represented Colleges */}
          <div className="p-4 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
                Colleges Represented
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
              {loading && !overview ? "..." : overview?.totalColleges ?? 0}
            </div>
            <div className="mt-1 text-[10px] text-[#94a3b8]">Academic institutions</div>
          </div>

          {/* Card 3: Total Questions Solved */}
          <div className="p-4 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
                Total Problems Solved
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {loading && !overview ? "..." : overview?.totalSolvedQuestions ?? 0}
            </div>
            <div className="mt-1 text-[10px] text-[#94a3b8]">Accepted solutions across cohort</div>
          </div>

          {/* Card 4: Top Performing Institution */}
          <div className="p-4 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-[#64748b] dark:text-[#94a3b8]">
                Leading Institution
              </span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-base font-extrabold tracking-tight text-[#0f172a] dark:text-white truncate">
              {overview?.topColleges?.[0]?.collegeName || "No data yet"}
            </div>
            <div className="mt-1 text-[10px] text-[#94a3b8]">
              {overview?.topColleges?.[0]
                ? `${overview.topColleges[0].totalSolved} solves (${overview.topColleges[0].studentCount} students)`
                : "Awaiting student activity"}
            </div>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="p-3.5 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, email, or student ID..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-hidden focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* College Filter Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#64748b] dark:text-[#94a3b8] hidden sm:inline font-medium">
                College:
              </span>
              <div className="relative">
                <select
                  value={selectedCollege}
                  onChange={(e) => setSelectedCollege(e.target.value)}
                  className="px-3 py-2 pr-8 text-xs font-medium rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-[#0f172a] dark:text-white focus:outline-hidden focus:border-blue-500 cursor-pointer appearance-none"
                >
                  <option value="ALL">All Colleges ({overview?.totalStudents ?? users.length})</option>
                  {collegesList.map((col) => (
                    <option key={col} value={col}>
                      {col} {collegeCounts[col] ? `(${collegeCounts[col]})` : ""}
                    </option>
                  ))}
                </select>
                <Filter className="w-3 h-3 text-[#94a3b8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#64748b] dark:text-[#94a3b8] hidden sm:inline font-medium">
                Sort:
              </span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 pr-8 text-xs font-medium rounded-xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-[#0f172a] dark:text-white focus:outline-hidden focus:border-blue-500 cursor-pointer appearance-none"
                >
                  <option value="solved_desc">Most Solved</option>
                  <option value="accuracy_desc">Highest Accuracy</option>
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="recent_joined">Recently Joined</option>
                </select>
                <ArrowUpDown className="w-3 h-3 text-[#94a3b8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Filter Reset if active */}
            {(selectedCollege !== "ALL" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCollege("ALL");
                  setSearchQuery("");
                }}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8] px-1">
          <div>
            Showing <strong className="text-[#0f172a] dark:text-white">{sortedUsers.length}</strong>{" "}
            {sortedUsers.length === 1 ? "student" : "students"}
            {selectedCollege !== "ALL" && (
              <span>
                {" "}
                from <strong className="text-blue-600 dark:text-blue-400">{selectedCollege}</strong>
              </span>
            )}
            {searchQuery && (
              <span>
                {" "}
                matching &quot;
                <strong className="text-[#0f172a] dark:text-white">{searchQuery}</strong>&quot;
              </span>
            )}
          </div>
        </div>

        {/* Main Users Table */}
        <div className="rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc]/80 dark:bg-[#0b0f17]/40 text-[11px] font-semibold text-[#64748b] dark:text-[#94a3b8]">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">College</th>
                  <th className="py-3 px-4">Questions Solved</th>
                  <th className="py-3 px-4">Submissions</th>
                  <th className="py-3 px-4">Accuracy</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b] text-xs">
                {loading && users.length === 0 ? (
                  // Loading skeletons
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-32 mb-1.5" />
                        <div className="h-3 bg-slate-100 dark:bg-slate-800/60 rounded-md w-24" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-28" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded-lg w-20" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-16" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-20" />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-24" />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded-lg w-16 ml-auto" />
                      </td>
                    </tr>
                  ))
                ) : sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748b] dark:text-[#94a3b8]">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users className="w-8 h-8 text-[#94a3b8] stroke-[1.5]" />
                        <p className="font-semibold text-[#0f172a] dark:text-white">
                          No students matched your criteria
                        </p>
                        <p className="text-xs max-w-sm text-[#64748b] dark:text-[#94a3b8]">
                          Try adjusting the college filter or clearing the search query to see more results.
                        </p>
                        {(selectedCollege !== "ALL" || searchQuery) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollege("ALL");
                              setSearchQuery("");
                            }}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            Reset All Filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => void openUserDetail(u.id)}
                      className="hover:bg-[#f8fafc] dark:hover:bg-[#1a2233]/70 transition-colors cursor-pointer group"
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-700 text-[#0f172a] dark:text-white text-xs font-bold flex items-center justify-center select-none flex-shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#0f172a] dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {u.name}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                              <span className="truncate max-w-[170px]">{u.email}</span>
                              <span className="font-mono text-[10px] px-1 py-0.2 bg-[#f1f5f9] dark:bg-[#1e293b] rounded text-[#475569] dark:text-[#94a3b8]">
                                {u.studentId}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* College */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f1f5f9] dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#283548] text-[11px] font-medium text-[#334155] dark:text-[#cbd5e1] max-w-[200px] truncate">
                          <Building2 className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
                          <span className="truncate">{u.collegeName}</span>
                        </span>
                      </td>

                      {/* Questions Solved & Difficulty Breakdown */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {u.totalSolved} Solved
                            </span>
                          </div>

                          {/* Difficulty Breakdown Pill Tags */}
                          <div className="flex items-center gap-1 text-[10px] font-mono">
                            <span
                              title={`${u.solvedBreakdown?.easy ?? 0} Easy solved`}
                              className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold"
                            >
                              E:{u.solvedBreakdown?.easy ?? 0}
                            </span>
                            <span
                              title={`${u.solvedBreakdown?.medium ?? 0} Medium solved`}
                              className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                            >
                              M:{u.solvedBreakdown?.medium ?? 0}
                            </span>
                            <span
                              title={`${u.solvedBreakdown?.hard ?? 0} Hard solved`}
                              className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold"
                            >
                              H:{u.solvedBreakdown?.hard ?? 0}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Submissions & Attempts */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-[#0f172a] dark:text-white">
                          {u.totalSubmissions} runs
                        </div>
                        <div className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                          {u.totalAttempted} problems attempted
                        </div>
                      </td>

                      {/* Accuracy Rate */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${Math.min(100, u.accuracyRate)}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-[#0f172a] dark:text-white">
                            {u.accuracyRate}%
                          </span>
                        </div>
                      </td>

                      {/* Last Active */}
                      <td className="py-3.5 px-4 text-[#64748b] dark:text-[#94a3b8] text-[11px]">
                        <div>{formatTimeAgo(u.lastActiveAt)}</div>
                        <div className="text-[10px] text-[#94a3b8]">Joined {formatDate(u.createdAt)}</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openUserDetail(u.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs font-medium text-[#334155] dark:text-[#cbd5e1] hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Slide-over User Detail Drawer */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            onClick={closeUserDetail}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white dark:bg-[#121824] border-l border-[#e2e8f0] dark:border-[#1e293b] shadow-2xl z-10 flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#e2e8f0] dark:border-[#1e293b] flex items-center justify-between bg-[#f8fafc] dark:bg-[#0b0f17]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  {userDetail?.name?.charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">
                    {userDetail?.name || "Student Details"}
                  </h3>
                  <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    {userDetail?.email || "Candidate performance dossier"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeUserDetail}
                className="p-1 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a2233] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
              {loadingDetail ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Loading student activity...</p>
                </div>
              ) : userDetail ? (
                <>
                  {/* Profile Summary Card */}
                  <div className="p-4 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc] dark:bg-[#0b0f17] flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Student ID</div>
                        <div className="font-mono font-medium text-[#0f172a] dark:text-white">
                          {userDetail.studentId}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Institution</div>
                        <div className="font-medium text-[#0f172a] dark:text-white truncate">
                          {userDetail.collegeName}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Account Created</div>
                        <div className="text-[#0f172a] dark:text-white">{formatDate(userDetail.createdAt)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#94a3b8] uppercase font-semibold">Pass Rate</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          {userDetail.accuracyRate}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Solved Problems Breakdown */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h4 className="text-xs font-bold text-[#0f172a] dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Solved Problems ({userDetail.solvedQuestions?.length ?? 0})</span>
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                          E:{userDetail.solvedBreakdown?.easy ?? 0}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                          M:{userDetail.solvedBreakdown?.medium ?? 0}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold">
                          H:{userDetail.solvedBreakdown?.hard ?? 0}
                        </span>
                      </div>
                    </div>

                    {userDetail.solvedQuestions && userDetail.solvedQuestions.length > 0 ? (
                      <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl overflow-hidden text-xs">
                        {userDetail.solvedQuestions.map((q) => (
                          <div
                            key={q.id}
                            className="p-3 flex items-center justify-between hover:bg-[#f8fafc] dark:hover:bg-[#1a2233] transition-colors"
                          >
                            <div className="min-w-0 pr-2">
                              <Link
                                href={`/?problem=${encodeURIComponent(q.slug)}`}
                                target="_blank"
                                className="font-medium text-[#0f172a] dark:text-white hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 truncate"
                              >
                                <span className="truncate">{q.title}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />
                              </Link>
                              {q.solvedAt && (
                                <div className="text-[10px] text-[#94a3b8]">
                                  Solved {formatDate(q.solvedAt)}
                                </div>
                              )}
                            </div>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                q.difficulty === "EASY"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : q.difficulty === "HARD"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              }`}
                            >
                              {q.difficulty}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-[#94a3b8] border border-dashed border-[#e2e8f0] dark:border-[#1e293b] rounded-xl">
                        No accepted solutions yet.
                      </div>
                    )}
                  </div>

                  {/* Recent Submissions Log */}
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white mb-2.5 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-blue-600" />
                      <span>Recent Submission Attempts</span>
                    </h4>

                    {userDetail.recentSubmissions && userDetail.recentSubmissions.length > 0 ? (
                      <div className="divide-y divide-[#e2e8f0] dark:divide-[#1e293b] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl overflow-hidden text-xs">
                        {userDetail.recentSubmissions.map((sub) => (
                          <div key={sub.id} className="p-2.5 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-mono text-[11px] font-semibold text-[#0f172a] dark:text-white">
                                {sub.questionId}
                              </div>
                              <div className="text-[10px] text-[#94a3b8] flex items-center gap-2">
                                <span className="uppercase font-mono">{sub.language}</span>
                                <span>•</span>
                                <span>{formatTimeAgo(sub.createdAt)}</span>
                              </div>
                            </div>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                sub.verdict === "ACCEPTED"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : sub.verdict === "WRONG_ANSWER"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              }`}
                            >
                              {sub.verdict || sub.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs text-[#94a3b8] border border-dashed border-[#e2e8f0] dark:border-[#1e293b] rounded-xl">
                        No submission logs available.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center text-xs text-rose-500 py-10">Could not retrieve user details.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
