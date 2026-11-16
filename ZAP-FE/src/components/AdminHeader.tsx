"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ArrowRight,
  Check,
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

const ITEMS_META: Record<
  AdminItem,
  {
    title: string;
    section: AdminSection;
    href: string;
    icon: typeof Users;
    badgeColor: string;
    desc: string;
  }
> = {
  overview: {
    title: "Admin Overview Hub",
    section: "overview",
    href: "/admin",
    icon: LayoutDashboard,
    badgeColor: "text-purple-600 bg-purple-500/10",
    desc: "Central operations hub & live metrics",
  },
  users: {
    title: "User Dashboard",
    section: "dashboard",
    href: "/admin/users",
    icon: Users,
    badgeColor: "text-blue-600 bg-blue-500/10",
    desc: "Student solve rates & college metrics",
  },
  "contests-analytics": {
    title: "Contest Dashboard",
    section: "dashboard",
    href: "/admin/contests/analytics",
    icon: BarChart3,
    badgeColor: "text-purple-600 bg-purple-500/10",
    desc: "Live submission analytics & telemetry",
  },
  questions: {
    title: "Coding Questions",
    section: "studio",
    href: "/admin/questions",
    icon: Code2,
    badgeColor: "text-indigo-600 bg-indigo-500/10",
    desc: "Create & configure algorithmic challenges",
  },
  mcq: {
    title: "MCQs",
    section: "studio",
    href: "/admin/mcq",
    icon: HelpCircle,
    badgeColor: "text-emerald-600 bg-emerald-500/10",
    desc: "Multiple choice question bank",
  },
  contests: {
    title: "Contests",
    section: "studio",
    href: "/admin/contests",
    icon: Trophy,
    badgeColor: "text-amber-600 bg-amber-500/10",
    desc: "Timed competitive assessments & schedules",
  },
};

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
  const [contextSwitcherOpen, setContextSwitcherOpen] = useState(false);
  const [dashboardsMenuOpen, setDashboardsMenuOpen] = useState(false);
  const [studioMenuOpen, setStudioMenuOpen] = useState(false);

  const switcherRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStudent(getStoredStudent());
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setContextSwitcherOpen(false);
      }
      if (dashboardRef.current && !dashboardRef.current.contains(e.target as Node)) {
        setDashboardsMenuOpen(false);
      }
      if (studioRef.current && !studioRef.current.contains(e.target as Node)) {
        setStudioMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const currentMeta = ITEMS_META[currentItem];
  const CurrentIcon = currentMeta.icon;

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
    <div className="sticky top-0 z-40 flex flex-col border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white/95 dark:bg-[#121824]/95 backdrop-blur-md shadow-xs transition-colors duration-200">
      {/* 1. Main Top Navigation Bar */}
      <header className="h-14 px-3 sm:px-6 flex items-center justify-between gap-3 max-w-7xl mx-auto w-full">
        {/* Left Section: Brand & Interactive Context Dropdown Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 group hover:opacity-90 transition-opacity"
            title="Return to Student Problem Arena"
          >
            <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs select-none shadow-sm shadow-blue-600/30 group-hover:scale-105 transition-transform flex-shrink-0">
              Z
            </span>
            <div className="hidden xs:flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight select-none text-[#0f172a] dark:text-white">
                ZAP
              </span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                Admin
              </span>
            </div>
          </Link>

          <span className="text-[#cbd5e1] dark:text-[#232f45] select-none">/</span>

          {/* Interactive Context Switcher (The user-friendly unified dropdown) */}
          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setContextSwitcherOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-[#0f172a] dark:text-white border border-purple-500/25 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title="Click to switch dashboard or studio tool"
            >
              <CurrentIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">{currentMeta.title}</span>
              <ChevronDown
                className={`w-3 h-3 text-purple-600 dark:text-purple-400 transition-transform ${contextSwitcherOpen ? "rotate-180" : ""
                  }`}
              />
            </button>

            {/* Dropdown Menu showing segregated Dashboards & Studio */}
            {contextSwitcherOpen && (
              <div className="absolute left-0 mt-1.5 w-80 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Admin Overview Link */}
                <Link
                  href="/admin"
                  onClick={() => setContextSwitcherOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl transition-colors ${currentItem === "overview"
                      ? "bg-purple-600 text-white font-semibold"
                      : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Admin Overview Hub</span>
                  </div>
                  {currentItem === "overview" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                </Link>

                {/* Section 1: DASHBOARDS */}
                <div className="space-y-0.5">
                  <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center justify-between">
                    <span>Dashboards (Analytics)</span>
                    <span className="text-[9px] font-sans font-normal text-blue-500 font-mono">2 Views</span>
                  </div>

                  <Link
                    href="/admin/users"
                    onClick={() => setContextSwitcherOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${currentItem === "users"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold border border-blue-500/30"
                        : "hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">User Dashboard</span>
                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Student solve rates & college metrics</span>
                      </div>
                    </div>
                    {currentItem === "users" && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                  </Link>

                  <Link
                    href="/admin/contests/analytics"
                    onClick={() => setContextSwitcherOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${currentItem === "contests-analytics"
                        ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/30"
                        : "hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BarChart3 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">Contest Dashboard</span>
                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Evaluations & proctoring telemetry</span>
                      </div>
                    </div>
                    {currentItem === "contests-analytics" && <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />}
                  </Link>
                </div>

                {/* Section 2: STUDIO */}
                <div className="space-y-0.5 border-t border-[#f1f5f9] dark:border-[#1a2233] pt-1.5">
                  <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] flex items-center justify-between">
                    <span>Studio (Authoring)</span>
                    <span className="text-[9px] font-sans font-normal text-purple-500 font-mono">3 Tools</span>
                  </div>

                  <Link
                    href="/admin/questions"
                    onClick={() => setContextSwitcherOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${currentItem === "questions"
                        ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/30"
                        : "hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Code2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">Coding Questions</span>
                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Challenges, starter code & tests</span>
                      </div>
                    </div>
                    {currentItem === "questions" && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                  </Link>

                  <Link
                    href="/admin/mcq"
                    onClick={() => setContextSwitcherOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${currentItem === "mcq"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/30"
                        : "hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">MCQs</span>
                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Multiple choice question bank</span>
                      </div>
                    </div>
                    {currentItem === "mcq" && <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                  </Link>

                  <Link
                    href="/admin/contests"
                    onClick={() => setContextSwitcherOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl transition-colors ${currentItem === "contests"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/30"
                        : "hover:bg-slate-100 dark:hover:bg-[#1a2233] text-[#0f172a] dark:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs">Contests</span>
                        <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Create & assemble timed events</span>
                      </div>
                    </div>
                    {currentItem === "contests" && <Check className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                  </Link>
                </div>

                {/* Footer Link */}
                <div className="border-t border-[#f1f5f9] dark:border-[#1a2233] pt-1">
                  <Link
                    href="/"
                    onClick={() => setContextSwitcherOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a2233] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-blue-500" />
                    <span>Return to Student Code Arena</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Section: Top-Level Wing Selector Menus (Desktop) */}
        <nav className="hidden lg:flex items-center gap-2">
          {/* Dashboards Dropdown */}
          <div className="relative" ref={dashboardRef}>
            <button
              type="button"
              onClick={() => {
                setDashboardsMenuOpen((prev) => !prev);
                setStudioMenuOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isDashboardActive
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 shadow-2xs"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
                }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
              <span>Dashboards</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {dashboardsMenuOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 text-xs">
                <Link
                  href="/admin/users"
                  onClick={() => setDashboardsMenuOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${currentItem === "users"
                      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    <span>User Dashboard</span>
                  </div>
                  {typeof userCount === "number" && userCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                      {userCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin/contests/analytics"
                  onClick={() => setDashboardsMenuOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${currentItem === "contests-analytics"
                      ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-purple-500" />
                    <span>Contest Dashboard</span>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* Studio Dropdown */}
          <div className="relative" ref={studioRef}>
            <button
              type="button"
              onClick={() => {
                setStudioMenuOpen((prev) => !prev);
                setDashboardsMenuOpen(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isStudioActive
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-2xs"
                  : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
                }`}
            >
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>Studio</span>
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>

            {studioMenuOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-xl shadow-xl p-1 z-50 flex flex-col gap-0.5 text-xs">
                <Link
                  href="/admin/questions"
                  onClick={() => setStudioMenuOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${currentItem === "questions"
                      ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Coding Questions</span>
                  </div>
                  {typeof questionCount === "number" && questionCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold">
                      {questionCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin/mcq"
                  onClick={() => setStudioMenuOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${currentItem === "mcq"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>MCQs</span>
                  </div>
                  {typeof mcqCount === "number" && mcqCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                      {mcqCount}
                    </span>
                  )}
                </Link>

                <Link
                  href="/admin/contests"
                  onClick={() => setStudioMenuOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${currentItem === "contests"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold"
                      : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Contests</span>
                  </div>
                  {typeof contestCount === "number" && contestCount > 0 && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                      {contestCount}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>

          {/* Hub Link */}
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${currentItem === "overview"
                ? "bg-purple-600 text-white shadow-2xs"
                : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white hover:bg-[#f1f5f9] dark:hover:bg-[#1a2233]"
              }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview</span>
          </Link>
        </nav>

        {/* Right Section: Return to Arena, Custom Action, Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {rightAction}

          {/* Quick Return to Code Arena */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#475569] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white bg-[#f8fafc] dark:bg-[#1a2233] border border-[#e2e8f0] dark:border-[#232f45] rounded-xl transition-all shadow-xs"
            title="Switch back to student coding arena"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Code Arena</span>
          </Link>

          {student && (
            <div className="hidden xl:flex items-center gap-2 border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-2.5 py-1 rounded-xl text-xs shadow-xs">
              <span className="w-4 h-4 rounded-full bg-purple-600/15 text-purple-600 dark:text-purple-400 text-[10px] font-bold flex items-center justify-center">
                {student.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-[11px] text-[#0f172a] dark:text-white truncate max-w-[110px]">
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

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-1.5 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white cursor-pointer"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. In-Page Sub-Navigation Tab Bar (Instant, User-Friendly Tab Switching) */}
      {currentItem !== "overview" && (
        <div className="border-t border-[#e2e8f0] dark:border-[#1e293b] bg-[#f8fafc]/90 dark:bg-[#0b0f17]/90 px-3 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
            {/* If in Dashboards: Show Dashboard Tabs */}
            {isDashboardActive && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold text-[#94a3b8] tracking-wider hidden md:inline mr-1">
                  Dashboard Views:
                </span>

                <div className="flex items-center gap-1.5 bg-white dark:bg-[#121824] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] shadow-2xs">
                  <Link
                    href="/admin/users"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentItem === "users"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                      }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>User Dashboard</span>
                    {typeof userCount === "number" && userCount > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold ${currentItem === "users" ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}>
                        {userCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/admin/contests/analytics"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentItem === "contests-analytics"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                      }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Contest Dashboard</span>
                  </Link>
                </div>
              </div>
            )}

            {/* If in Studio: Show Studio Tabs */}
            {isStudioActive && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono font-bold text-[#94a3b8] tracking-wider hidden md:inline mr-1">
                  Studio Tools:
                </span>

                <div className="flex items-center gap-1.5 bg-white dark:bg-[#121824] p-1 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] shadow-2xs">
                  <Link
                    href="/admin/questions"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentItem === "questions"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                      }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Coding Questions</span>
                    {typeof questionCount === "number" && questionCount > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold ${currentItem === "questions" ? "bg-white/20 text-white" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        }`}>
                        {questionCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/admin/mcq"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentItem === "mcq"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                      }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>MCQs</span>
                    {typeof mcqCount === "number" && mcqCount > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold ${currentItem === "mcq" ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}>
                        {mcqCount}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/admin/contests"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${currentItem === "contests"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                      }`}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Contests</span>
                    {typeof contestCount === "number" && contestCount > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md font-bold ${currentItem === "contests" ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}>
                        {contestCount}
                      </span>
                    )}
                  </Link>
                </div>
              </div>
            )}

            {/* Quick Cross-Pillar Jump Link */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDashboardActive ? (
                <Link
                  href="/admin/questions"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold transition-all shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Go to Studio (Authoring)</span>
                  <span className="sm:hidden">Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              ) : (
                <Link
                  href="/admin/users"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-all shadow-2xs"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Go to Dashboards (Analytics)</span>
                  <span className="sm:hidden">Dashboards</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 py-4 space-y-4 shadow-md max-h-[85vh] overflow-y-auto">
          {/* Back to Code Arena */}
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Code Arena</span>
          </Link>

          {/* Overview Hub */}
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${currentItem === "overview"
                ? "bg-purple-600 text-white"
                : "text-[#64748b] dark:text-[#94a3b8] hover:bg-slate-100 dark:hover:bg-[#1a2233]"
              }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className="w-4 h-4" />
              <span>Admin Overview Hub</span>
            </div>
            {currentItem === "overview" && <Check className="w-4 h-4" />}
          </Link>

          {/* Section 1: Dashboards */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] px-2 flex items-center justify-between">
              <span>Dashboards (Analytics)</span>
              <span className="text-blue-500 font-sans">2 views</span>
            </div>
            <Link
              href="/admin/users"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${currentItem === "users"
                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4 text-blue-500" />
                <div className="flex flex-col">
                  <span>User Dashboard</span>
                  <span className="text-[10px] font-normal text-[#94a3b8]">Student & college metrics</span>
                </div>
              </div>
              {currentItem === "users" && <Check className="w-4 h-4 text-blue-600" />}
            </Link>
            <Link
              href="/admin/contests/analytics"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${currentItem === "contests-analytics"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <div className="flex flex-col">
                  <span>Contest Dashboard</span>
                  <span className="text-[10px] font-normal text-[#94a3b8]">Submission evaluations</span>
                </div>
              </div>
              {currentItem === "contests-analytics" && <Check className="w-4 h-4 text-purple-600" />}
            </Link>
          </div>

          {/* Section 2: Studio */}
          <div className="space-y-1 border-t border-[#f1f5f9] dark:border-[#1a2233] pt-3">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8] px-2 flex items-center justify-between">
              <span>Studio (Authoring)</span>
              <span className="text-purple-500 font-sans">3 tools</span>
            </div>
            <Link
              href="/admin/questions"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${currentItem === "questions"
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Code2 className="w-4 h-4 text-indigo-500" />
                <div className="flex flex-col">
                  <span>Coding Questions</span>
                  <span className="text-[10px] font-normal text-[#94a3b8]">Unit tests & algorithms</span>
                </div>
              </div>
              {currentItem === "questions" && <Check className="w-4 h-4 text-indigo-600" />}
            </Link>
            <Link
              href="/admin/mcq"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${currentItem === "mcq"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-emerald-500" />
                <div className="flex flex-col">
                  <span>MCQs</span>
                  <span className="text-[10px] font-normal text-[#94a3b8]">Multiple choice database</span>
                </div>
              </div>
              {currentItem === "mcq" && <Check className="w-4 h-4 text-emerald-600" />}
            </Link>
            <Link
              href="/admin/contests"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${currentItem === "contests"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                  : "text-[#475569] dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#1a2233]"
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <div className="flex flex-col">
                  <span>Contests</span>
                  <span className="text-[10px] font-normal text-[#94a3b8]">Timed assessment composer</span>
                </div>
              </div>
              {currentItem === "contests" && <Check className="w-4 h-4 text-amber-600" />}
            </Link>
          </div>

          {student && (
            <div className="pt-2 border-t border-[#f1f5f9] dark:border-[#1a2233] flex items-center justify-between text-xs text-[#64748b]">
              <span>Signed in as <strong className="text-[#0f172a] dark:text-white">{student.name}</strong></span>
              <button
                type="button"
                onClick={() => authApi.logout()}
                className="text-rose-600 font-semibold"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
