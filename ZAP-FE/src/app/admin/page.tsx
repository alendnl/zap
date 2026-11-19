"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  BarChart3,
  Code2,
  HelpCircle,
  Trophy,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Activity,
  Layers,
  Database,
  ExternalLink,
  BookOpen,
  Flame,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { getStoredStudent } from "@/services/authApi";
import { adminApi, AdminUsersOverview } from "@/services/adminApi";
import { questionsApi } from "@/services/questionsApi";
import { mcqApi } from "@/services/mcqApi";
import { contestApi } from "@/services/contestApi";
import type { Student } from "@/types/auth";

export default function AdminOverviewHub() {
  const [student, setStudent] = useState<Student | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Platform metrics
  const [loadingStats, setLoadingStats] = useState(true);
  const [userOverview, setUserOverview] = useState<AdminUsersOverview | null>(null);
  const [questionsCount, setQuestionsCount] = useState<number>(0);
  const [mcqCount, setMcqCount] = useState<number>(0);
  const [contestCount, setContestCount] = useState<number>(0);

  // Auth verification
  useEffect(() => {
    const currentStudent = getStoredStudent();
    setStudent(currentStudent);
    if (!currentStudent?.email) {
      setAuthChecking(false);
      setIsAdmin(false);
      return;
    }

    const cleanEmail = currentStudent.email.toLowerCase().trim();
    const isOwnerOrAdmin =
      cleanEmail === "alendnl@gmail.com" ||
      cleanEmail.includes("admin") ||
      (currentStudent as any)?.role === "admin" ||
      (typeof window !== "undefined" && localStorage.getItem("zap_is_admin") === "true");

    if (isOwnerOrAdmin) {
      setIsAdmin(true);
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
        if (!isOwnerOrAdmin) {
          setIsAdmin(false);
        }
        setAuthChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch quick metrics for the hub
  const fetchOverviewStats = useCallback(async () => {
    if (!student?.email || !isAdmin) return;
    setLoadingStats(true);
    try {
      const [usersData, questionsList, mcqList, contestsList] = await Promise.allSettled([
        adminApi.getUsersDashboard(student.email, undefined, undefined, 1, 1),
        questionsApi.list(undefined, true),
        mcqApi.list(undefined, undefined, undefined, undefined, true),
        contestApi.list(undefined, true),
      ]);

      if (usersData.status === "fulfilled") {
        setUserOverview(usersData.value.overview);
      }
      if (questionsList.status === "fulfilled") {
        setQuestionsCount(questionsList.value.length);
      }
      if (mcqList.status === "fulfilled") {
        setMcqCount(mcqList.value.length);
      }
      if (contestsList.status === "fulfilled") {
        setContestCount(contestsList.value.length);
      }
    } catch {
      // Graceful fallback to zeros
    } finally {
      setLoadingStats(false);
    }
  }, [student?.email, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void fetchOverviewStats();
    }
  }, [isAdmin, fetchOverviewStats]);

  // Loading state
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-spin" />
          <p className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
            Verifying administrative access permissions...
          </p>
        </div>
      </div>
    );
  }

  // Not logged in
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
            Please log in with an administrator account to access the ZAP Admin Hub.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition-colors shadow-sm"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Not in admin collection
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
            The account <strong className="text-[#0f172a] dark:text-white font-mono">{student.email}</strong> does not have administrative privileges.
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

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col font-sans transition-colors duration-200">
      <AdminHeader
        activeSection="overview"
        activeItem="overview"
        userCount={userOverview?.totalStudents}
        questionCount={questionsCount}
        mcqCount={mcqCount}
        contestCount={contestCount}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-900/20 via-indigo-900/10 to-transparent border border-purple-500/20 p-6 sm:p-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>ZAP Administrative Operations Hub</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
              Operations, Telemetry & Studio Management
            </h1>
            <p className="text-xs sm:text-sm text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
              Organized into two core pillars: <strong className="text-[#0f172a] dark:text-white font-semibold">Dashboards</strong> for observing candidate activity and contest telemetry, and <strong className="text-[#0f172a] dark:text-white font-semibold">Studio</strong> for authoring questions, tests, and timed competitive events.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-purple-500/15">
            <div className="bg-white/80 dark:bg-[#121824]/80 backdrop-blur-xs p-3.5 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] block">Registered Candidates</span>
              <span className="text-xl sm:text-2xl font-extrabold text-[#0f172a] dark:text-white font-mono mt-0.5 block">
                {loadingStats ? "..." : userOverview?.totalStudents ?? 0}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-[#121824]/80 backdrop-blur-xs p-3.5 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] block">Coding Challenges</span>
              <span className="text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                {loadingStats ? "..." : questionsCount}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-[#121824]/80 backdrop-blur-xs p-3.5 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] block">MCQs in Database</span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                {loadingStats ? "..." : mcqCount}
              </span>
            </div>
            <div className="bg-white/80 dark:bg-[#121824]/80 backdrop-blur-xs p-3.5 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[11px] font-mono text-[#64748b] dark:text-[#94a3b8] block">Contest Events</span>
              <span className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
                {loadingStats ? "..." : contestCount}
              </span>
            </div>
          </div>
        </div>

        {/* PILLAR 1: DASHBOARDS */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
                  Dashboards & Observability
                </h2>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Cohort-level insights, individual candidate performance profiles, and live contest analytics.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. User Dashboard */}
            <Link
              href="/admin/users"
              className="group relative bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-blue-500/50 dark:hover:border-blue-500/50 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                    Live Telemetry
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                  <span>User Dashboard</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Real-time directory of student profiles, college breakdown, total solved count, accuracy rates, and detailed drill-down activity drawer.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-[#64748b] dark:text-[#94a3b8] font-mono text-[11px]">
                  {userOverview ? `${userOverview.totalStudents} Candidates enrolled` : "Metrics ready"}
                </span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span>Explore Users</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>

            {/* 2. Contest Dashboard */}
            <Link
              href="/admin/contests/analytics"
              className="group relative bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-purple-500/50 dark:hover:border-purple-500/50 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                    Leaderboards & Audits
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                  <span>Contest Dashboard</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Contest-wide submission logs, question-by-question pass rates, candidate code review viewer, and proctoring telemetry audit trail.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-[#64748b] dark:text-[#94a3b8] font-mono text-[11px]">
                  Real-time submission inspection
                </span>
                <span className="font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <span>View Telemetry</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* PILLAR 2: STUDIO */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
                  Studio & Assessment Authoring
                </h2>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Authoring environments for coding challenges, conceptual MCQs, and timed contest environments.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Coding Questions */}
            <Link
              href="/admin/questions"
              className="group relative bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-indigo-500/50 dark:hover:border-indigo-500/50 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                    Unit Test Engine
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                  <span>Coding Questions</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Compose problem descriptions, configure multi-language starter templates, and set up public and hidden test cases with execution limits.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-[#64748b] dark:text-[#94a3b8] font-mono text-[11px]">
                  {questionsCount} Problems configured
                </span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <span>Author Code</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>

            {/* 2. MCQs */}
            <Link
              href="/admin/mcq"
              className="group relative bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-emerald-500/50 dark:hover:border-emerald-500/50 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    Question Bank
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  <span>MCQs</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Create single and multiple choice questions with code snippets, detailed answer explanations, and category tagging.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-[#64748b] dark:text-[#94a3b8] font-mono text-[11px]">
                  {mcqCount} Questions in bank
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>Manage MCQs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>

            {/* 3. Contests */}
            <Link
              href="/admin/contests"
              className="group relative bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-amber-500/50 dark:hover:border-amber-500/50 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    Live Arena
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                  <span>Contests</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Design timed competitive contests, combine curated MCQs and coding challenges, configure proctoring limits, and schedule tests.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-[#64748b] dark:text-[#94a3b8] font-mono text-[11px]">
                  {contestCount} Contests configured
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span>Assemble Contest</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </div>
        </section>

        {/* PILLAR 3: OPERATIONS & INFRASTRUCTURE */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0f172a] dark:text-white">
                  Operations & Infrastructure Testing
                </h2>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Direct browser-driven stress testing and telemetry for production API and sandboxed compilers with strict lower DB isolation.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Load Testing Studio Card */}
            <Link
              href="/admin/load-test"
              className="group relative bg-white dark:bg-[#121824] rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] hover:border-amber-500/50 dark:hover:border-amber-500/50 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Flame className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    QA Lower DB Locked
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1.5">
                  <span>Load Testing Studio</span>
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Direct in-browser load testing engine. Configure virtual users, ramp-up schedules, target REST routes or compilation-heavy C++/Java sandboxes, monitor real-time RPS, and manage lower DB test data.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-[#64748b] dark:text-[#94a3b8] font-mono text-[11px]">
                  Configurable API & Compiler Engine
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span>Launch Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>

            {/* Safety & Environment Guardrail Summary Card */}
            <div className="bg-white/60 dark:bg-[#121824]/60 rounded-2xl border border-[#e2e8f0] dark:border-[#1e293b] p-6 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Architecture Invariant
                  </span>
                </div>
                <h3 className="text-base font-bold text-[#0f172a] dark:text-white">
                  Zero Production Contamination
                </h3>
                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                  Single Cloud Run deployment topology with dynamic request-header environment routing. All test accounts, code submissions, and execution metrics strictly use <code className="text-emerald-500 font-mono">zap_platform_lower</code> and lower Cloud Tasks queues.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-semibold">
                  ✓ X-ZAP-ENV: qa auto-injected
                </span>
                <Link
                  href="/admin/load-test"
                  className="font-semibold text-slate-600 dark:text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <span>Purge Lower Data</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
