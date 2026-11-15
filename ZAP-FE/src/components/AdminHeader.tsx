"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  BarChart3,
  Code2,
  HelpCircle,
  Trophy,
  ShieldCheck,
  ArrowLeft,
  ChevronDown,
  LayoutDashboard,
  Layers,
  Menu,
  X,
  LogOut,
  Sparkles,
} from "lucide-react";
import { EnvironmentSwitcher } from "@/components/EnvironmentSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getStoredStudent, authApi } from "@/services/authApi";
import type { Student } from "@/types/auth";

export type AdminSection = "dashboard" | "studio" | "overview";
export type AdminItem =
  | "overview"
  | "users"
  | "contests-analytics"
  | "questions"
  | "mcq"
  | "contests";

interface AdminHeaderProps {
  activeSection?: AdminSection;
  activeItem?: AdminItem;
  rightAction?: React.ReactNode;
  userCount?: number;
  contestCount?: number;
  questionCount?: number;
  mcqCount?: number;
}

export function AdminHeader({
  activeSection,
  activeItem,
  rightAction,
  userCount,
  contestCount,
  questionCount,
  mcqCount,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const [student, setStudent] = useState<Student | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardDropdownOpen, setDashboardDropdownOpen] = useState(false);
  const [studioDropdownOpen, setStudioDropdownOpen] = useState(false);

  useEffect(() => {
    setStudent(getStoredStudent());
  }, []);

  // Determine current active item from prop or pathname
  const currentItem: AdminItem =
    activeItem ||
    (pathname === "/admin"
      ? "overview"
      : pathname.startsWith("/admin/users")
      ? "users"
      : pathname.startsWith("/admin/contests/analytics")
      ? "contests-analytics"
      : pathname.startsWith("/admin/questions")
      ? "questions"
      : pathname.startsWith("/admin/mcq")
      ? "mcq"
      : pathname.startsWith("/admin/contests")
      ? "contests"
      : "overview");

  const isDashboardActive =
    activeSection === "dashboard" ||
    currentItem === "users" ||
    currentItem === "contests-analytics";

  const isStudioActive =
    activeSection === "studio" ||
    currentItem === "questions" ||
    currentItem === "mcq" ||
    currentItem === "contests";

  return (
    <header className="sticky top-0 z-30 border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md flex-shrink-0 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left Section: Brand, Return to Arena, Admin Hub */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-95 transition-opacity"
            title="Return to Student Problem Arena"
          >
            <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shadow-blue-600/30 group-hover:scale-105 transition-transform">
              Z
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight select-none text-[#0f172a] dark:text-white">
                ZAP
              </span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                Admin
              </span>
            </div>
          </Link>

          {/* Quick Back to Code Arena */}
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] rounded-lg transition-all shadow-xs"
            title="Switch back to student coding arena"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden md:inline">Code Arena</span>
          </Link>

          <span className="hidden lg:inline text-[#cbd5e1] dark:text-[#232f45]">|</span>

          {/* Desktop Dual Navigation: Dashboard & Studio */}
          <nav className="hidden lg:flex items-center gap-2">
            {/* Overview / Hub */}
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg text-xs font-semibold transition-all ${
                currentItem === "overview"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Overview</span>
            </Link>

            {/* Pillar 1: Dashboards */}
            <div className="flex items-center bg-[#f1f5f9] dark:bg-[#0b0f17] p-0.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[10px] uppercase font-mono font-bold px-2 text-[#94a3b8] select-none">
                Dashboard
              </span>

              <Link
                href="/admin/users"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  currentItem === "users"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
                title="Users Dashboard — Student performance & college cohort metrics"
              >
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>User Dashboard</span>
                {typeof userCount === "number" && userCount > 0 && (
                  <span className="text-[9px] font-mono px-1 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                    {userCount}
                  </span>
                )}
              </Link>

              <Link
                href="/admin/contests/analytics"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  currentItem === "contests-analytics"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
                title="Contest Dashboard — Live submission analytics, leaderboard & proctoring"
              >
                <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                <span>Contest Dashboard</span>
              </Link>
            </div>

            {/* Pillar 2: Studio */}
            <div className="flex items-center bg-[#f1f5f9] dark:bg-[#0b0f17] p-0.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b]">
              <span className="text-[10px] uppercase font-mono font-bold px-2 text-[#94a3b8] select-none">
                Studio
              </span>

              <Link
                href="/admin/questions"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  currentItem === "questions"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
                title="Coding Questions — Create & configure algorithmic challenges"
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Coding Questions</span>
                {typeof questionCount === "number" && questionCount > 0 && (
                  <span className="text-[9px] font-mono px-1 rounded-sm bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                    {questionCount}
                  </span>
                )}
              </Link>

              <Link
                href="/admin/mcq"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  currentItem === "mcq"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
                title="MCQs — Curate multiple choice questions database"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>MCQs</span>
                {typeof mcqCount === "number" && mcqCount > 0 && (
                  <span className="text-[9px] font-mono px-1 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                    {mcqCount}
                  </span>
                )}
              </Link>

              <Link
                href="/admin/contests"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all ${
                  currentItem === "contests"
                    ? "bg-white dark:bg-[#1a2233] text-[#0f172a] dark:text-white font-semibold shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                }`}
                title="Contests — Build, schedule, and assemble timed competitive assessments"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Contests</span>
                {typeof contestCount === "number" && contestCount > 0 && (
                  <span className="text-[9px] font-mono px-1 rounded-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                    {contestCount}
                  </span>
                )}
              </Link>
            </div>
          </nav>

          {/* Medium Screen Dropdowns (sm to lg) */}
          <div className="hidden sm:flex lg:hidden items-center gap-1.5">
            <Link
              href="/admin"
              className={`p-1.5 rounded-lg text-xs font-semibold ${
                currentItem === "overview"
                  ? "bg-purple-600 text-white"
                  : "text-[#64748b] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
              }`}
              title="Admin Overview Hub"
            >
              <LayoutDashboard className="w-4 h-4" />
            </Link>

            {/* Dashboard Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setDashboardDropdownOpen((prev) => !prev);
                  setStudioDropdownOpen(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isDashboardActive
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                <span>Dashboard</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {dashboardDropdownOpen && (
                <div
                  onMouseLeave={() => setDashboardDropdownOpen(false)}
                  className="absolute left-0 mt-1 w-48 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 text-xs"
                >
                  <Link
                    href="/admin/users"
                    onClick={() => setDashboardDropdownOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      currentItem === "users"
                        ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>User Dashboard</span>
                  </Link>
                  <Link
                    href="/admin/contests/analytics"
                    onClick={() => setDashboardDropdownOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      currentItem === "contests-analytics"
                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                    <span>Contest Dashboard</span>
                  </Link>
                </div>
              )}
            </div>

            {/* Studio Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setStudioDropdownOpen((prev) => !prev);
                  setDashboardDropdownOpen(false);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isStudioActive
                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                    : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>Studio</span>
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>

              {studioDropdownOpen && (
                <div
                  onMouseLeave={() => setStudioDropdownOpen(false)}
                  className="absolute left-0 mt-1 w-48 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 text-xs"
                >
                  <Link
                    href="/admin/questions"
                    onClick={() => setStudioDropdownOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      currentItem === "questions"
                        ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Coding Questions</span>
                  </Link>
                  <Link
                    href="/admin/mcq"
                    onClick={() => setStudioDropdownOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      currentItem === "mcq"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>MCQs</span>
                  </Link>
                  <Link
                    href="/admin/contests"
                    onClick={() => setStudioDropdownOpen(false)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      currentItem === "contests"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Contests</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Custom Action, Session, Environment, Theme */}
        <div className="flex items-center gap-2">
          {rightAction}

          {student && (
            <div className="hidden md:flex items-center gap-2 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs shadow-xs">
              <span className="w-4 h-4 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white truncate max-w-[120px]">
                {student.name}
              </span>
              <button
                type="button"
                onClick={() => authApi.logout()}
                title="Sign out of admin session"
                className="ml-0.5 text-[#64748b] dark:text-[#94a3b8] hover:text-rose-600 dark:hover:text-rose-400 p-0.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <EnvironmentSwitcher />
          <ThemeToggle />

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 py-4 space-y-4 shadow-md">
          {/* Back to Code Arena */}
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Code Arena</span>
          </Link>

          {/* Overview */}
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
              currentItem === "overview"
                ? "bg-purple-600 text-white"
                : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Admin Overview Hub</span>
          </Link>

          {/* Section 1: Dashboards */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] px-2">
              Dashboards (Analytics)
            </div>
            <Link
              href="/admin/users"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                currentItem === "users"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>User Dashboard</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">Student metrics</span>
            </Link>
            <Link
              href="/admin/contests/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                currentItem === "contests-analytics"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span>Contest Dashboard</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">Evaluations</span>
            </Link>
          </div>

          {/* Section 2: Studio */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] px-2">
              Studio (Authoring)
            </div>
            <Link
              href="/admin/questions"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                currentItem === "questions"
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <span>Coding Questions</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">Unit tests</span>
            </Link>
            <Link
              href="/admin/mcq"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                currentItem === "mcq"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
              }`}
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-500" />
                <span>MCQs</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">Question bank</span>
            </Link>
            <Link
              href="/admin/contests"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                currentItem === "contests"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Contests</span>
              </div>
              <span className="text-[10px] text-[#94a3b8]">Scheduling</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
