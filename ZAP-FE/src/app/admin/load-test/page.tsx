"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Flame,
  Play,
  Pause,
  Square,
  Trash2,
  RotateCcw,
  Download,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Terminal,
  Cpu,
  Globe,
  Sliders,
  Save,
  Database,
  History,
  RefreshCw,
  BarChart2,
  Layers,
  Sparkles,
  Info,
  Clock,
  Zap,
} from "lucide-react";
import { AdminHeader } from "@/components/AdminHeader";
import { getStoredStudent } from "@/services/authApi";
import { adminApi } from "@/services/adminApi";
import { loadTestApi, SavedLoadTestConfig, LowerDataStats } from "@/services/loadTestApi";
import {
  UnifiedLoadTestConfig,
  TargetService,
  SupportedLanguage,
  WorkloadComplexity,
  RampUpStyle,
  ExecutorMode,
  LiveMetrics,
  LoadTestRunReport,
  LogEntry,
} from "@/lib/load-test/types";
import { LoadTestRunner } from "@/lib/load-test/runner";
import { DEFAULT_LOAD_TEST_PRESETS } from "@/lib/load-test/presets";
import type { Student } from "@/types/auth";

type ActiveTab = "config" | "monitor" | "results" | "history";

const AVAILABLE_LANGUAGES: { id: SupportedLanguage; label: string; badge: string }[] = [
  { id: "cpp", label: "C++ (g++)", badge: "Compilation Heavy" },
  { id: "java", label: "Java (javac/JVM)", badge: "Memory & Compilation Heavy" },
  { id: "python", label: "Python (3.14)", badge: "Interpreted Sandbox" },
  { id: "c", label: "C (gcc)", badge: "Fast Compilation" },
  { id: "javascript", label: "JavaScript (Node)", badge: "V8 Engine" },
];

const DEFAULT_API_ENDPOINTS = [
  { id: "/api/v1/questions?summary=true", label: "Questions Listing (/api/v1/questions)", desc: "Reads active algorithmic problems" },
  { id: "/api/v1/mcq", label: "MCQ Listing (/api/v1/mcq)", desc: "Reads active multiple choice bank" },
  { id: "/api/v1/contests", label: "Contests Listing (/api/v1/contests)", desc: "Reads active & upcoming contests" },
  { id: "/api/v1/submissions", label: "Submissions Feed (/api/v1/submissions)", desc: "Reads recent platform submissions" },
  { id: "/api/v1/auth/signup", label: "Synthetic User Signup (/api/v1/auth/signup)", desc: "Generates new QA student account" },
];

export default function AdminLoadTestingPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>("config");

  // Config State
  const [config, setConfig] = useState<UnifiedLoadTestConfig>(DEFAULT_LOAD_TEST_PRESETS[0]);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);

  // Runner & Live Metrics
  const runnerRef = useRef<LoadTestRunner | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [isTestActive, setIsTestActive] = useState<boolean>(false);
  const [lastReport, setLastReport] = useState<LoadTestRunReport | null>(null);

  // Terminal & Logs
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Lower DB Stats & Clean Modal
  const [dataStats, setDataStats] = useState<LowerDataStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [cleanModalOpen, setCleanModalOpen] = useState(false);
  const [cleanTarget, setCleanTarget] = useState<"synthetic" | "all_test_data">("synthetic");
  const [cleanConfirmText, setCleanConfirmText] = useState("");
  const [cleaningInProgress, setCleaningInProgress] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);

  // Saved Configs & History
  const [savedConfigs, setSavedConfigs] = useState<SavedLoadTestConfig[]>([]);
  const [historicalRuns, setHistoricalRuns] = useState<LoadTestRunReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  // 1. Auth Guardrail Verification
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

  // 2. Fetch Lower DB stats & Saved history when admin authorized
  const fetchDbStats = useCallback(async () => {
    if (!student?.email || !isAdmin) return;
    setLoadingStats(true);
    try {
      const stats = await loadTestApi.getDataStats(student.email);
      setDataStats(stats);
    } catch (err) {
      console.error("Failed fetching lower DB stats", err);
    } finally {
      setLoadingStats(false);
    }
  }, [student?.email, isAdmin]);

  const fetchHistoryAndConfigs = useCallback(async () => {
    if (!student?.email || !isAdmin) return;
    setLoadingHistory(true);
    try {
      const [configs, runs] = await Promise.all([
        loadTestApi.listConfigs(student.email),
        loadTestApi.listRuns(student.email, 20),
      ]);
      setSavedConfigs(configs);
      setHistoricalRuns(runs);
    } catch (err) {
      console.error("Failed fetching configs/runs", err);
    } finally {
      setLoadingHistory(false);
    }
  }, [student?.email, isAdmin]);

  useEffect(() => {
    if (isAdmin && student?.email) {
      fetchDbStats();
      fetchHistoryAndConfigs();
    }
  }, [isAdmin, student?.email, fetchDbStats, fetchHistoryAndConfigs]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScrollLogs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [liveMetrics?.recentLogs, autoScrollLogs]);

  // 3. Preset selection handler
  const handleSelectPreset = (index: number) => {
    setSelectedPresetIndex(index);
    const preset = DEFAULT_LOAD_TEST_PRESETS[index];
    if (preset) {
      setConfig(JSON.parse(JSON.stringify(preset)));
    }
  };

  // 4. Start Load Test
  const handleStartTest = async () => {
    if (isTestActive) return;

    setActiveTab("monitor");
    setIsTestActive(true);

    const runner = new LoadTestRunner(
      config,
      (updatedMetrics) => {
        setLiveMetrics(updatedMetrics);
      }
    );
    runnerRef.current = runner;

    try {
      const report = await runner.start();
      setLastReport(report);
      setIsTestActive(false);
      setActiveTab("results");

      // Auto-save run record to QA database
      if (student?.email) {
        try {
          await loadTestApi.recordRun(student.email, {
            configName: report.configName,
            targetService: report.targetService,
            status: report.status,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            summary: report.summary,
            testConfigSnapshot: report.testConfigSnapshot,
          });
          fetchDbStats();
          fetchHistoryAndConfigs();
        } catch (saveErr) {
          console.warn("Failed recording run in DB", saveErr);
        }
      }
    } catch (err: any) {
      console.error("Test run error", err);
      setIsTestActive(false);
    }
  };

  // 5. Controls
  const handlePauseResume = () => {
    if (!runnerRef.current) return;
    if (liveMetrics?.status === "PAUSED") {
      runnerRef.current.resume();
    } else {
      runnerRef.current.pause();
    }
  };

  const handleAbort = () => {
    if (!runnerRef.current) return;
    runnerRef.current.abort();
    setIsTestActive(false);
  };

  // 6. Save current config to QA MongoDB
  const handleSavePreset = async () => {
    if (!student?.email || savingPreset) return;
    setSavingPreset(true);
    try {
      await loadTestApi.createConfig(student.email, {
        name: config.name,
        description: config.description || "Custom configured test profile",
        targetService: config.targetService,
        config,
      });
      alert(`Configuration "${config.name}" saved successfully to QA Lower DB.`);
      fetchHistoryAndConfigs();
    } catch (err: any) {
      alert(`Failed saving config: ${err.message}`);
    } finally {
      setSavingPreset(false);
    }
  };

  // 7. Delete Saved Config
  const handleDeleteConfig = async (configId: string) => {
    if (!student?.email) return;
    if (!confirm("Are you sure you want to delete this saved configuration?")) return;
    try {
      await loadTestApi.deleteConfig(student.email, configId);
      fetchHistoryAndConfigs();
    } catch (err: any) {
      alert(`Failed deleting config: ${err.message}`);
    }
  };

  // 8. Delete Run Record
  const handleDeleteRun = async (runId: string) => {
    if (!student?.email) return;
    if (!confirm("Are you sure you want to delete this test run record?")) return;
    try {
      await loadTestApi.deleteRun(student.email, runId);
      fetchHistoryAndConfigs();
    } catch (err: any) {
      alert(`Failed deleting run: ${err.message}`);
    }
  };

  // 9. Clean Lower DB Data
  const handleCleanData = async () => {
    if (!student?.email) return;
    if (cleanConfirmText.trim().toLowerCase() !== "clean-lower") {
      alert("You must type 'clean-lower' to proceed.");
      return;
    }

    setCleaningInProgress(true);
    setCleanMessage(null);
    try {
      const res = await loadTestApi.cleanLowerData(student.email, cleanTarget, cleanConfirmText);
      setCleanMessage(res.message);
      fetchDbStats();
      setTimeout(() => {
        setCleanModalOpen(false);
        setCleanConfirmText("");
        setCleanMessage(null);
      }, 2500);
    } catch (err: any) {
      alert(`Cleanup failed: ${err.message}`);
    } finally {
      setCleaningInProgress(false);
    }
  };

  // 10. Export JSON Report
  const handleExportJson = () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = lastReport.configName.toLowerCase().replace(/\s+/g, "_");
    link.href = url;
    link.download = `zap_loadtest_${name}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Loading & Access Denied states
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-500 animate-spin" />
          <span className="text-sm font-mono text-[#64748b] dark:text-slate-400">Verifying Admin Access & Guardrails...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-slate-100">
        <AdminHeader />
        <div className="max-w-2xl mx-auto mt-20 p-8 rounded-2xl bg-white dark:bg-[#161b22] border border-rose-500/30 text-center space-y-4 shadow-sm">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-[#0f172a] dark:text-white">Admin Privileges Required</h2>
          <p className="text-sm text-[#64748b] dark:text-slate-400">
            The Load Testing & Stress Studio is restricted to platform administrators. Your account does
            not have the required authorization.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            Return to Arena
          </Link>
        </div>
      </div>
    );
  }

  // Calculated estimates
  const totalEstimatedRequests =
    config.targetService === "api"
      ? config.apiConfig.users * Math.max(1, Math.floor(config.apiConfig.durationSeconds / Math.max(0.2, (config.apiConfig.thinkTimeMs + 100) / 1000)))
      : config.executorConfig.users * config.executorConfig.submissionsPerUser;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Admin Header */}
      <AdminHeader />

      {/* Sub-Header & Strict Environment Guardrail Bar */}
      <div className="border-b border-[#e2e8f0] dark:border-[#1f293d] bg-white/90 dark:bg-[#0f1726]/80 backdrop-blur-md sticky top-14 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-white">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-[#0f172a] dark:text-white tracking-tight">Load Testing Studio</h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                  In-Browser Runner
                </span>
              </div>
              <p className="text-xs text-[#64748b] dark:text-slate-400">
                Direct front-end stress engine testing production server compute with lower database isolation.
              </p>
            </div>
          </div>

          {/* Strict Guardrail Badge & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-semibold shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>LOWER DB LOCKED: zap_platform_lower</span>
            </div>

            <button
              type="button"
              onClick={() => {
                fetchDbStats();
                setCleanModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f1f5f9] dark:bg-slate-800 hover:bg-[#e2e8f0] dark:hover:bg-slate-700 text-[#0f172a] dark:text-slate-200 border border-[#cbd5e1] dark:border-slate-700 text-xs font-semibold transition-all shadow-xs cursor-pointer"
              title="Inspect Lower DB data and purge synthetic test records"
            >
              <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Clean Lower DB</span>
              {dataStats && (
                <span className="ml-1 px-1.5 py-0.2 rounded-md bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-mono">
                  {dataStats.syntheticUsersCount + dataStats.syntheticSubmissionsCount} items
                </span>
              )}
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="max-w-7xl mx-auto flex items-center gap-1 mt-4 border-b border-[#e2e8f0] dark:border-[#1e293b]">
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "config"
                ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
                : "border-transparent text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure & Presets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("monitor")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "monitor"
                ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
                : "border-transparent text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Live Monitor</span>
            {isTestActive && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("results")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "results"
                ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
                : "border-transparent text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Results & Analytics</span>
            {lastReport && (
              <span className="px-1.5 py-0.2 rounded-md bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] font-mono">
                {lastReport.summary.totalRequests} reqs
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "history"
                ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10"
                : "border-transparent text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Saved Configs & History</span>
            <span className="px-1.5 py-0.2 rounded-md bg-[#e2e8f0] dark:bg-slate-800 text-[#475569] dark:text-slate-400 text-[10px] font-mono">
              {historicalRuns.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6">
        {/* ================================================================= */}
        {/* TAB 1: CONFIGURE & PRESETS */}
        {/* ================================================================= */}
        {activeTab === "config" && (
          <div className="space-y-6">
            {/* Presets Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Select Pre-Configured Test Profile
                </span>
                <span className="text-[11px] text-[#64748b] dark:text-slate-400">
                  Click any card to populate parameters
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DEFAULT_LOAD_TEST_PRESETS.map((preset, idx) => {
                  const isSelected = selectedPresetIndex === idx;
                  const isApi = preset.targetService === "api";
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(idx)}
                      className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10"
                          : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] hover:border-blue-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#1a253a]"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-[#0f172a] dark:text-white tracking-tight">
                            {preset.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                              isApi
                                ? "bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20"
                                : "bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            }`}
                          >
                            {preset.targetService.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748b] dark:text-slate-400 line-clamp-2">
                          {preset.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] font-mono text-[#64748b] dark:text-slate-400 border-t border-[#e2e8f0] dark:border-[#233149] pt-2">
                        <span>
                          👥 {isApi ? preset.apiConfig.users : preset.executorConfig.users} VUs
                        </span>
                        <span>
                          ⚡ {isApi ? `${preset.apiConfig.durationSeconds}s` : `${preset.executorConfig.submissionsPerUser} subs/user`}
                        </span>
                        <span>
                          📈 {isApi ? preset.apiConfig.rampUpStyle : preset.executorConfig.rampUpStyle}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Service Toggle */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Target System / Subsystem
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-slate-400">
                    Select whether you want to test general REST API endpoints or the compiler sandbox execution engine.
                  </p>
                </div>

                <div className="inline-flex p-1 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                  <button
                    type="button"
                    onClick={() => {
                      setConfig((prev) => ({ ...prev, targetService: "api" }));
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      config.targetService === "api"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>ZAP API (REST Endpoints)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setConfig((prev) => ({
                        ...prev,
                        targetService: "executor",
                        executorConfig: { ...prev.executorConfig, mode: "full_submission" },
                      }));
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      config.targetService === "executor"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-white"
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>ZAP Executor (Sandboxed Compiler)</span>
                  </button>
                </div>
              </div>

              {/* Service Explanation Banner */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  config.targetService === "api"
                    ? "bg-blue-500/10 border-blue-500/25 text-blue-800 dark:text-blue-300"
                    : "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300"
                }`}
              >
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  {config.targetService === "api" ? (
                    <span>
                      <strong>ZAP API Mode:</strong> Stresses the central FastAPI REST service (questions, MCQs,
                      contests, submissions feed, and synthetic user registration). Benchmarks database read/write
                      concurrency and network throughput.
                    </span>
                  ) : (
                    <span>
                      <strong>ZAP Executor Mode:</strong> Stresses the isolated compiler sandbox container. Benchmarks
                      real code compilation (g++, javac, gcc) and runtime execution across C++, Java, Python, C, and
                      JavaScript with strict CPU, memory, and timeout caps.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Test Configuration Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Form Parameters */}
              <div className="lg:col-span-2 space-y-6">
                {/* General Settings */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-4">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    1. Test Identity & Concurrency
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-slate-300 mb-1">
                        Test Profile Name
                      </label>
                      <input
                        type="text"
                        value={config.name}
                        onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#161f30] border border-[#cbd5e1] dark:border-[#223048] text-[#0f172a] dark:text-white text-xs focus:outline-hidden focus:border-blue-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-slate-300 mb-1">
                        Ramp-Up Profile
                      </label>
                      <select
                        value={
                          config.targetService === "api"
                            ? config.apiConfig.rampUpStyle
                            : config.executorConfig.rampUpStyle
                        }
                        onChange={(e) => {
                          const val = e.target.value as RampUpStyle;
                          if (config.targetService === "api") {
                            setConfig((prev) => ({
                              ...prev,
                              apiConfig: { ...prev.apiConfig, rampUpStyle: val },
                            }));
                          } else {
                            setConfig((prev) => ({
                              ...prev,
                              executorConfig: { ...prev.executorConfig, rampUpStyle: val },
                            }));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#161f30] border border-[#cbd5e1] dark:border-[#223048] text-[#0f172a] dark:text-white text-xs focus:outline-hidden focus:border-blue-500 shadow-xs"
                      >
                        <option value="instant">Instant Spike (All VUs start immediately)</option>
                        <option value="gradual">Gradual Linear Ramp-Up (Slow to high)</option>
                      </select>
                    </div>
                  </div>

                  {/* Sliders */}
                  {config.targetService === "api" ? (
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#334155] dark:text-slate-300">Virtual Users (Concurrency):</span>
                          <span className="font-mono font-bold text-blue-400">
                            {config.apiConfig.users} users
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={150}
                          value={config.apiConfig.users}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              apiConfig: { ...prev.apiConfig, users: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-blue-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#334155] dark:text-slate-300">Test Duration:</span>
                          <span className="font-mono font-bold text-blue-400">
                            {config.apiConfig.durationSeconds} seconds
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={180}
                          step={5}
                          value={config.apiConfig.durationSeconds}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              apiConfig: { ...prev.apiConfig, durationSeconds: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-blue-500 cursor-pointer"
                        />
                      </div>

                      {config.apiConfig.rampUpStyle === "gradual" && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#334155] dark:text-slate-300">Spawn Rate:</span>
                            <span className="font-mono font-bold text-blue-400">
                              {config.apiConfig.spawnRate} users / sec
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={25}
                            value={config.apiConfig.spawnRate}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                apiConfig: { ...prev.apiConfig, spawnRate: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-blue-500 cursor-pointer"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#334155] dark:text-slate-300">Think Time / Request Delay:</span>
                          <span className="font-mono font-bold text-blue-400">
                            {config.apiConfig.thinkTimeMs} ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={2000}
                          step={50}
                          value={config.apiConfig.thinkTimeMs}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              apiConfig: { ...prev.apiConfig, thinkTimeMs: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-blue-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pt-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#334155] dark:text-slate-300">Virtual Users (Simultaneous Coders):</span>
                          <span className="font-mono font-bold text-amber-400">
                            {config.executorConfig.users} users
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={50}
                          value={config.executorConfig.users}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              executorConfig: { ...prev.executorConfig, users: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#334155] dark:text-slate-300">Submissions per User:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {config.executorConfig.submissionsPerUser} submissions
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={15}
                          value={config.executorConfig.submissionsPerUser}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              executorConfig: { ...prev.executorConfig, submissionsPerUser: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      {config.executorConfig.rampUpStyle === "gradual" && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#334155] dark:text-slate-300">Spawn Rate:</span>
                            <span className="font-mono font-bold text-amber-400">
                              {config.executorConfig.spawnRate} users / sec
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={config.executorConfig.spawnRate}
                            onChange={(e) =>
                              setConfig((prev) => ({
                                ...prev,
                                executorConfig: { ...prev.executorConfig, spawnRate: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#334155] dark:text-slate-300">Think Time Between Submissions:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {config.executorConfig.thinkTimeMs} ms
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={3000}
                          step={100}
                          value={config.executorConfig.thinkTimeMs}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              executorConfig: { ...prev.executorConfig, thinkTimeMs: Number(e.target.value) },
                            }))
                          }
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Subsystem Specific Configuration */}
                {config.targetService === "api" ? (
                  /* API Endpoints Selection */
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                      2. Target API Endpoints
                    </h4>
                    <p className="text-xs text-[#64748b] dark:text-slate-400">
                      Select which API endpoints the virtual users will query. Requests will be distributed randomly across selected routes.
                    </p>

                    <div className="space-y-2 pt-1">
                      {DEFAULT_API_ENDPOINTS.map((ep) => {
                        const isChecked = config.apiConfig.endpoints.includes(ep.id);
                        return (
                          <label
                            key={ep.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-blue-50 dark:bg-blue-600/10 border-blue-500/50 text-[#0f172a] dark:text-white shadow-xs"
                                : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const newEndpoints = e.target.checked
                                  ? [...config.apiConfig.endpoints, ep.id]
                                  : config.apiConfig.endpoints.filter((id) => id !== ep.id);
                                if (newEndpoints.length > 0) {
                                  setConfig((prev) => ({
                                    ...prev,
                                    apiConfig: { ...prev.apiConfig, endpoints: newEndpoints },
                                  }));
                                }
                              }}
                              className="mt-0.5 accent-blue-600 rounded"
                            />
                            <div className="space-y-0.5">
                              <span className="font-semibold text-xs text-[#0f172a] dark:text-white block">
                                {ep.label}
                              </span>
                              <span className="text-[11px] text-[#64748b] dark:text-slate-400">{ep.desc}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Executor Specific Configuration */
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-4">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                      2. Compiler & Sandbox Configuration
                    </h4>

                    {/* Mode */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-slate-300 mb-1.5">
                        Execution Mode
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            config.executorConfig.mode === "compiler_run"
                              ? "bg-amber-50 dark:bg-amber-600/15 border-amber-500 text-[#0f172a] dark:text-white shadow-xs"
                              : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="executor_mode"
                              checked={config.executorConfig.mode === "compiler_run"}
                              onChange={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  executorConfig: { ...prev.executorConfig, mode: "compiler_run" },
                                }))
                              }
                              className="accent-amber-500"
                            />
                            <span className="font-bold text-xs text-[#0f172a] dark:text-white">Direct Compiler Benchmark</span>
                          </div>
                          <span className="text-[11px] text-[#64748b] dark:text-slate-400 mt-1 pl-5">
                            POST /api/v1/compiler/run synchronous execution. Tests raw compiler RPS without Cloud Tasks queue overhead.
                          </span>
                        </label>

                        <label
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                            config.executorConfig.mode === "full_submission"
                              ? "bg-purple-50 dark:bg-purple-600/15 border-purple-500 text-[#0f172a] dark:text-white shadow-xs"
                              : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="executor_mode"
                              checked={config.executorConfig.mode === "full_submission"}
                              onChange={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  executorConfig: { ...prev.executorConfig, mode: "full_submission" },
                                }))
                              }
                              className="accent-purple-500"
                            />
                            <span className="font-bold text-xs text-[#0f172a] dark:text-white">Full Async Submission</span>
                          </div>
                          <span className="text-[11px] text-[#64748b] dark:text-slate-400 mt-1 pl-5">
                            Real-world flow: synthetic signup -&gt; POST /submissions -&gt; Cloud Tasks execution -&gt; Polling latch in QA DB.
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Programming Languages */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-slate-300 mb-1.5">
                        Programming Languages to Test
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {AVAILABLE_LANGUAGES.map((lang) => {
                          const isSelected = config.executorConfig.languages.includes(lang.id);
                          return (
                            <label
                              key={lang.id}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-amber-50 dark:bg-amber-600/10 border-amber-500/50 text-[#0f172a] dark:text-white shadow-xs"
                                  : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400 hover:border-blue-300 dark:hover:border-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...config.executorConfig.languages, lang.id]
                                      : config.executorConfig.languages.filter((l) => l !== lang.id);
                                    if (next.length > 0) {
                                      setConfig((prev) => ({
                                        ...prev,
                                        executorConfig: { ...prev.executorConfig, languages: next },
                                      }));
                                    }
                                  }}
                                  className="accent-amber-500"
                                />
                                <span className="font-bold text-xs">{lang.label}</span>
                              </div>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#e2e8f0] dark:bg-slate-800 text-[#475569] dark:text-slate-400">
                                {lang.badge}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Workload Complexity */}
                    <div>
                      <label className="block text-xs font-semibold text-[#0f172a] dark:text-slate-300 mb-1.5">
                        Code Workload Complexity
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["light", "medium", "heavy"] as WorkloadComplexity[]).map((c) => {
                          const isSel = config.executorConfig.complexity === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  executorConfig: { ...prev.executorConfig, complexity: c },
                                }))
                              }
                              className={`py-2 px-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                                isSel
                                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                                  : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-white"
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Col: Summary & Action Card */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-4 sticky top-36">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    Execution Summary
                  </h4>

                  <div className="space-y-3 divide-y divide-[#e2e8f0] dark:divide-[#1e293b] text-xs">
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#64748b] dark:text-slate-400">Target Service:</span>
                      <span className="font-bold font-mono text-[#0f172a] dark:text-white">
                        {config.targetService.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#64748b] dark:text-slate-400">Simulated VUs:</span>
                      <span className="font-bold font-mono text-blue-400">
                        {config.targetService === "api"
                          ? config.apiConfig.users
                          : config.executorConfig.users}{" "}
                        users
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#64748b] dark:text-slate-400">Est. Total Requests:</span>
                      <span className="font-bold font-mono text-emerald-400">
                        ~{totalEstimatedRequests} requests
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#64748b] dark:text-slate-400">Ramp-Up Profile:</span>
                      <span className="font-bold font-mono text-purple-400 uppercase">
                        {config.targetService === "api"
                          ? config.apiConfig.rampUpStyle
                          : config.executorConfig.rampUpStyle}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[#64748b] dark:text-slate-400">Target Database:</span>
                      <span className="font-bold font-mono text-emerald-400">
                        zap_platform_lower
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button
                      type="button"
                      disabled={isTestActive}
                      onClick={handleStartTest}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start In-Browser Load Test</span>
                    </button>

                    <button
                      type="button"
                      disabled={savingPreset}
                      onClick={handleSavePreset}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#f1f5f9] dark:bg-slate-800 hover:bg-[#e2e8f0] dark:hover:bg-slate-700 text-[#0f172a] dark:text-slate-200 border border-[#cbd5e1] dark:border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingPreset ? "Saving..." : "Save Custom Preset to QA DB"}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[#e2e8f0] dark:border-slate-800 text-[11px] text-[#64748b] dark:text-slate-400 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>
                      Zero-risk execution: All operations strictly append <code className="text-emerald-300 font-mono">X-ZAP-ENV: qa</code>. Production data remains 100% isolated.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: LIVE MONITOR */}
        {/* ================================================================= */}
        {activeTab === "monitor" && (
          <div className="space-y-6">
            {/* Live Controller Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full ${
                    liveMetrics?.status === "RUNNING"
                      ? "bg-emerald-500 animate-ping"
                      : liveMetrics?.status === "PAUSED"
                      ? "bg-amber-500"
                      : liveMetrics?.status === "COMPLETED"
                      ? "bg-blue-500"
                      : liveMetrics?.status === "ABORTED"
                      ? "bg-rose-500"
                      : "bg-slate-500"
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#0f172a] dark:text-white">{config.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        liveMetrics?.status === "RUNNING"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : liveMetrics?.status === "PAUSED"
                          ? "bg-amber-500/20 text-amber-400"
                          : liveMetrics?.status === "COMPLETED"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {liveMetrics?.status || "READY"}
                    </span>
                  </div>
                  <span className="text-xs text-[#64748b] dark:text-slate-400">
                    Elapsed Time:{" "}
                    <strong className="text-[#0f172a] dark:text-white font-mono">{liveMetrics?.elapsedSeconds || 0}s</strong>
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {liveMetrics?.status === "RUNNING" && (
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 text-xs font-semibold cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause</span>
                  </button>
                )}

                {liveMetrics?.status === "PAUSED" && (
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume</span>
                  </button>
                )}

                {(liveMetrics?.status === "RUNNING" || liveMetrics?.status === "PAUSED") && (
                  <button
                    type="button"
                    onClick={handleAbort}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-semibold cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>Abort Run</span>
                  </button>
                )}

                {!isTestActive && (
                  <button
                    type="button"
                    onClick={handleStartTest}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-Run Test</span>
                  </button>
                )}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 block mb-1">
                  Active Virtual Users
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold font-mono text-[#0f172a] dark:text-white">
                    {liveMetrics?.activeVirtualUsers || 0}
                  </span>
                  <span className="text-xs text-[#64748b] dark:text-slate-400 font-mono">
                    / {liveMetrics?.totalVirtualUsers || 0} VUs
                  </span>
                </div>
                <div className="w-full bg-[#e2e8f0] dark:bg-[#1e293b] h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        liveMetrics?.totalVirtualUsers
                          ? ((liveMetrics.activeVirtualUsers || 0) / liveMetrics.totalVirtualUsers) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 block mb-1">
                  Throughput (RPS)
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold font-mono text-emerald-400">
                    {liveMetrics?.currentRps || 0}
                  </span>
                  <span className="text-xs text-[#64748b] dark:text-slate-400 font-mono">
                    req/s (Peak: {liveMetrics?.peakRps || 0})
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 block">
                  Completed: {liveMetrics?.totalRequests || 0} reqs
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 block mb-1">
                  Success Rate
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold font-mono text-purple-400">
                    {liveMetrics?.successRate || 100}%
                  </span>
                  <span className="text-xs text-[#64748b] dark:text-slate-400 font-mono">
                    ({liveMetrics?.failedRequests || 0} fails)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 block">
                  OK: {liveMetrics?.successfulRequests || 0}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 block mb-1">
                  Latency (p50 / p95)
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold font-mono text-amber-400">
                    {liveMetrics?.p50LatencyMs || 0}
                  </span>
                  <span className="text-xs text-[#64748b] dark:text-slate-400 font-mono">
                    ms (p95: {liveMetrics?.p95LatencyMs || 0}ms)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 block">
                  Avg: {liveMetrics?.avgLatencyMs || 0}ms | Max: {liveMetrics?.maxLatencyMs || 0}ms
                </span>
              </div>
            </div>

            {/* Live Chart: Throughput & Latency Over Time */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  Live Throughput Timeline (RPS & Active VUs)
                </span>
                <span className="text-[10px] font-mono text-slate-500">Last 60 seconds</span>
              </div>

              {liveMetrics?.timeline && liveMetrics.timeline.length > 0 ? (
                <div className="h-32 flex items-end gap-1 border-b border-[#e2e8f0] dark:border-[#1f293d] pb-1 overflow-x-auto pt-4">
                  {liveMetrics.timeline.slice(-60).map((tick, i) => {
                    const maxRps = Math.max(10, liveMetrics.peakRps || 1);
                    const heightPercent = Math.min(100, Math.round((tick.rps / maxRps) * 100));
                    return (
                      <div
                        key={i}
                        className="flex-1 min-w-[6px] flex flex-col items-center justify-end group relative"
                      >
                        <div
                          className="w-full bg-blue-500/80 hover:bg-blue-400 rounded-t-xs transition-all"
                          style={{ height: `${Math.max(4, heightPercent)}%` }}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-lg border border-slate-700 whitespace-nowrap">
                            T+{tick.time}s | {tick.rps} RPS | {tick.avgLatency}ms
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-slate-500 font-mono">
                  Waiting for test traffic ticks...
                </div>
              )}
            </div>

            {/* Live Terminal Output Stream */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#090d14] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#334155] dark:text-slate-300">
                    Live Telemetry Stream
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-[#64748b] dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoScrollLogs}
                      onChange={(e) => setAutoScrollLogs(e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                    <span>Auto-scroll</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {liveMetrics?.recentLogs.length || 0} events
                  </span>
                </div>
              </div>

              <div
                ref={logsContainerRef}
                className="h-64 overflow-y-auto font-mono text-xs space-y-1 pr-2 bg-slate-950 dark:bg-[#06090e] p-3 rounded-xl border border-slate-800 dark:border-[#151c28] text-slate-100"
              >
                {liveMetrics?.recentLogs && liveMetrics.recentLogs.length > 0 ? (
                  liveMetrics.recentLogs.map((log) => {
                    const is2xx = log.status >= 200 && log.status < 300;
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-2 leading-relaxed ${
                          log.isError
                            ? "text-rose-400"
                            : is2xx
                            ? "text-slate-300"
                            : "text-amber-400"
                        }`}
                      >
                        <span className="text-slate-600 select-none">{log.timestamp}</span>
                        <span className="text-blue-400 font-bold select-none">
                          [VU#{String(log.vu).padStart(2, "0")}]
                        </span>
                        <span className="text-purple-400">{log.method}</span>
                        <span className="text-slate-200">{log.target}</span>
                        <span
                          className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                            is2xx
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                          }`}
                        >
                          {log.status}
                        </span>
                        <span className="text-amber-300/80">{log.durationMs}ms</span>
                        {log.message && <span className="text-[#64748b] dark:text-slate-400">({log.message})</span>}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-600 italic">No execution events recorded yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: RESULTS & ANALYTICS */}
        {/* ================================================================= */}
        {activeTab === "results" && (
          <div className="space-y-6">
            {!lastReport ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
                <BarChart2 className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-[#0f172a] dark:text-white">No Test Results Available</h3>
                <p className="text-xs text-[#64748b] dark:text-slate-400 max-w-md mx-auto">
                  Run a load test from the Configure tab or load a previous test run from the History tab to inspect comprehensive analytics.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("config")}
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                >
                  Go to Configurator
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Result Header */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#0f172a] dark:text-white">{lastReport.configName}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          lastReport.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {lastReport.status}
                      </span>
                    </div>
                    <span className="text-xs text-[#64748b] dark:text-slate-400">
                      Started: {new Date(lastReport.startedAt).toLocaleTimeString()} | Duration:{" "}
                      {lastReport.summary.totalTimeSeconds}s | Target: {lastReport.targetService.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f1f5f9] dark:bg-slate-800 hover:bg-[#e2e8f0] dark:hover:bg-slate-700 text-[#0f172a] dark:text-slate-200 border border-[#cbd5e1] dark:border-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                      <span>Export JSON Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfig(lastReport.testConfigSnapshot);
                        setActiveTab("config");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-Run Preset</span>
                    </button>
                  </div>
                </div>

                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-slate-400 uppercase block">Total Requests</span>
                    <span className="text-xl font-bold font-mono text-[#0f172a] dark:text-white mt-1 block">
                      {lastReport.summary.totalRequests}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-slate-400 uppercase block">Success Rate</span>
                    <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                      {lastReport.summary.successRate}%
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-slate-400 uppercase block">Overall RPS</span>
                    <span className="text-xl font-bold font-mono text-blue-400 mt-1 block">
                      {lastReport.summary.overallRps}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-slate-400 uppercase block">Peak RPS</span>
                    <span className="text-xl font-bold font-mono text-purple-400 mt-1 block">
                      {lastReport.summary.peakRps}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-slate-400 uppercase block">Median (p50)</span>
                    <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">
                      {lastReport.summary.latencyPercentiles.p50}ms
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs">
                    <span className="text-[10px] font-mono text-[#64748b] dark:text-slate-400 uppercase block">95th % (p95)</span>
                    <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                      {lastReport.summary.latencyPercentiles.p95}ms
                    </span>
                  </div>
                </div>

                {/* Latency Percentiles Table */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    Response Time Percentiles (Full Test Suite)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1 font-mono text-center">
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">Min</span>
                      <span className="font-bold text-[#0f172a] dark:text-white text-sm">{lastReport.summary.latencyPercentiles.min}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">Average</span>
                      <span className="font-bold text-[#0f172a] dark:text-white text-sm">{lastReport.summary.latencyPercentiles.avg}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">p50</span>
                      <span className="font-bold text-emerald-400 text-sm">{lastReport.summary.latencyPercentiles.p50}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">p75</span>
                      <span className="font-bold text-[#0f172a] dark:text-white text-sm">{lastReport.summary.latencyPercentiles.p75}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">p90</span>
                      <span className="font-bold text-amber-400 text-sm">{lastReport.summary.latencyPercentiles.p90}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">p95</span>
                      <span className="font-bold text-amber-500 text-sm">{lastReport.summary.latencyPercentiles.p95}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">p99</span>
                      <span className="font-bold text-rose-400 text-sm">{lastReport.summary.latencyPercentiles.p99}ms</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048]">
                      <span className="text-[10px] text-[#64748b] dark:text-slate-400 block">Max</span>
                      <span className="font-bold text-rose-500 text-sm">{lastReport.summary.latencyPercentiles.max}ms</span>
                    </div>
                  </div>
                </div>

                {/* HTTP Status Code Distribution */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                    HTTP Response Status Distribution
                  </h4>
                  <div className="flex flex-wrap items-center gap-3">
                    {Object.entries(lastReport.summary.statusCounts).map(([statusStr, count]) => {
                      const statusCode = Number(statusStr);
                      const is2xx = statusCode >= 200 && statusCode < 300;
                      return (
                        <div
                          key={statusStr}
                          className={`px-3 py-2 rounded-xl border flex items-center gap-2 font-mono text-xs ${
                            is2xx
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          }`}
                        >
                          <span className="font-bold">{statusStr}</span>
                          <span className="text-[#64748b] dark:text-slate-400">({count} requests)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Endpoint or Language Breakdown */}
                {lastReport.summary.languageBreakdown && Object.keys(lastReport.summary.languageBreakdown).length > 0 && (
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                      Compiler Breakdown by Programming Language
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[11px] text-[#64748b] dark:text-slate-400 border-b border-[#e2e8f0] dark:border-[#1f293d]">
                          <tr>
                            <th className="py-2.5">Language</th>
                            <th className="py-2.5">Total Runs</th>
                            <th className="py-2.5">Failures</th>
                            <th className="py-2.5">Avg Latency</th>
                            <th className="py-2.5">p50</th>
                            <th className="py-2.5">p95</th>
                            <th className="py-2.5">Max Latency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#182234]">
                          {Object.entries(lastReport.summary.languageBreakdown).map(([lang, metric]: any) => (
                            <tr key={lang} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 font-bold uppercase text-amber-400">{lang}</td>
                              <td className="py-2.5 text-[#0f172a] dark:text-white">{metric.count}</td>
                              <td className="py-2.5 text-rose-400">{metric.fails}</td>
                              <td className="py-2.5 text-[#334155] dark:text-slate-300">{metric.avg_ms}ms</td>
                              <td className="py-2.5 text-emerald-400">{metric.p50_ms}ms</td>
                              <td className="py-2.5 text-amber-400">{metric.p95_ms}ms</td>
                              <td className="py-2.5 text-[#64748b] dark:text-slate-400">{metric.max_ms}ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Endpoint Breakdown */}
                {lastReport.summary.endpoints && Object.keys(lastReport.summary.endpoints).length > 0 && (
                  <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#64748b] dark:text-slate-400">
                      Breakdown by API Endpoint Route
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="text-[11px] text-[#64748b] dark:text-slate-400 border-b border-[#e2e8f0] dark:border-[#1f293d]">
                          <tr>
                            <th className="py-2.5">Endpoint</th>
                            <th className="py-2.5">Count</th>
                            <th className="py-2.5">Failures</th>
                            <th className="py-2.5">Avg</th>
                            <th className="py-2.5">p50</th>
                            <th className="py-2.5">p95</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#182234]">
                          {Object.entries(lastReport.summary.endpoints).map(([ep, metric]: any) => (
                            <tr key={ep} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 font-semibold text-blue-400 truncate max-w-xs">{ep}</td>
                              <td className="py-2.5 text-[#0f172a] dark:text-white">{metric.count}</td>
                              <td className="py-2.5 text-rose-400">{metric.fails}</td>
                              <td className="py-2.5 text-[#334155] dark:text-slate-300">{metric.avg_ms}ms</td>
                              <td className="py-2.5 text-emerald-400">{metric.p50_ms}ms</td>
                              <td className="py-2.5 text-amber-400">{metric.p95_ms}ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: SAVED CONFIGS & HISTORY */}
        {/* ================================================================= */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Top Saved Configurations */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                    <Save className="w-4 h-4 text-blue-400" />
                    Saved Custom Test Configurations (QA MongoDB)
                  </h3>
                  <p className="text-xs text-[#64748b] dark:text-slate-400">
                    Saved in collection <code className="text-emerald-400 font-mono">load_test_configs</code> in lower DB.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchHistoryAndConfigs}
                  className="p-1.5 rounded-lg bg-[#f1f5f9] dark:bg-slate-800 hover:bg-[#e2e8f0] dark:hover:bg-slate-700 text-[#334155] dark:text-slate-300 border border-[#cbd5e1] dark:border-slate-700"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                </button>
              </div>

              {savedConfigs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  No saved configurations yet. Configure a test and click &quot;Save Custom Preset to QA DB&quot;.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {savedConfigs.map((cfg) => (
                    <div
                      key={cfg.id}
                      className="p-4 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048] flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#0f172a] dark:text-white">{cfg.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                              cfg.targetService === "api"
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {cfg.targetService}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748b] dark:text-slate-400">{cfg.description}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#e2e8f0] dark:border-[#233149] text-xs">
                        <span className="text-[10px] text-slate-500 font-mono">
                          Saved by: {cfg.createdBy || "Admin"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfig(cfg.config);
                              setActiveTab("config");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Load Configuration
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteConfig(cfg.id)}
                            className="p-1 rounded-lg hover:bg-rose-500/20 text-[#64748b] dark:text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete config"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historical Runs */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                Historical Test Runs (QA MongoDB)
              </h3>

              {historicalRuns.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 italic">
                  No historical test runs recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-[11px] text-[#64748b] dark:text-slate-400 border-b border-[#e2e8f0] dark:border-[#1f293d]">
                      <tr>
                        <th className="py-2.5">Run Name</th>
                        <th className="py-2.5">Target</th>
                        <th className="py-2.5">Date & Time</th>
                        <th className="py-2.5">Total Reqs</th>
                        <th className="py-2.5">Success Rate</th>
                        <th className="py-2.5">RPS</th>
                        <th className="py-2.5">p50</th>
                        <th className="py-2.5">p95</th>
                        <th className="py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0] dark:divide-[#182234]">
                      {historicalRuns.map((run: any) => (
                        <tr key={run.id || run._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 font-bold text-[#0f172a] dark:text-white">{run.configName}</td>
                          <td className="py-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                                run.targetService === "api"
                                  ? "bg-cyan-500/20 text-cyan-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {run.targetService}
                            </span>
                          </td>
                          <td className="py-3 text-[#64748b] dark:text-slate-400">
                            {new Date(run.startedAt).toLocaleString()}
                          </td>
                          <td className="py-3 text-[#0f172a] dark:text-white">{run.summary?.totalRequests}</td>
                          <td className="py-3 text-emerald-400">{run.summary?.successRate}%</td>
                          <td className="py-3 text-blue-400">{run.summary?.overallRps}</td>
                          <td className="py-3 text-amber-400">{run.summary?.latencyPercentiles?.p50}ms</td>
                          <td className="py-3 text-rose-400">{run.summary?.latencyPercentiles?.p95}ms</td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setLastReport(run);
                                  setActiveTab("results");
                                }}
                                className="px-2 py-1 rounded bg-[#f1f5f9] dark:bg-slate-800 hover:bg-[#e2e8f0] dark:hover:bg-slate-700 text-[#0f172a] dark:text-slate-200 border border-[#cbd5e1] dark:border-slate-700 text-[11px]"
                              >
                                View Report
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRun(run.id)}
                                className="p-1 rounded hover:bg-rose-500/20 text-[#64748b] dark:text-slate-400 hover:text-rose-400"
                                title="Delete Run Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* CLEAN LOWER DB MODAL */}
      {/* ===================================================================== */}
      {cleanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121824] border border-rose-500/40 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0f172a] dark:text-white">Clean Lower Database Data</h3>
                  <span className="text-xs font-mono text-emerald-400">Target: zap_platform_lower</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCleanModalOpen(false)}
                className="text-[#64748b] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Current Stats */}
            <div className="p-3.5 rounded-xl bg-[#f1f5f9] dark:bg-[#161f30] border border-[#e2e8f0] dark:border-[#223048] space-y-1.5 text-xs font-mono">
              <span className="text-[10px] text-[#64748b] dark:text-slate-400 uppercase tracking-wider block mb-1">
                Current Records in zap_platform_lower
              </span>
              <div className="grid grid-cols-2 gap-2 text-[#334155] dark:text-slate-300">
                <div>
                  Synthetic Users:{" "}
                  <strong className="text-amber-400">{dataStats?.syntheticUsersCount ?? 0}</strong>
                </div>
                <div>
                  Total Users:{" "}
                  <strong className="text-[#0f172a] dark:text-white">{dataStats?.totalUsersCount ?? 0}</strong>
                </div>
                <div>
                  Synthetic Submissions:{" "}
                  <strong className="text-amber-400">
                    {dataStats?.syntheticSubmissionsCount ?? 0}
                  </strong>
                </div>
                <div>
                  Total Submissions:{" "}
                  <strong className="text-[#0f172a] dark:text-white">{dataStats?.totalSubmissionsCount ?? 0}</strong>
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2 text-xs">
              <label className="block text-[#334155] dark:text-slate-300 font-semibold mb-1">Select Cleanup Scope:</label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  cleanTarget === "synthetic"
                    ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500/40 text-[#0f172a] dark:text-white shadow-xs"
                    : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="clean_target"
                  checked={cleanTarget === "synthetic"}
                  onChange={() => setCleanTarget("synthetic")}
                  className="mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="font-bold block text-[#0f172a] dark:text-white">
                    Clean Synthetic Load-Test Records Only (Recommended)
                  </span>
                  <span className="text-[11px] text-[#64748b] dark:text-slate-400">
                    Deletes only generated accounts matching <code className="text-amber-300">loadtest_*</code> and their submissions. Preserves regular QA test questions & faculty accounts.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                  cleanTarget === "all_test_data"
                    ? "bg-rose-50 dark:bg-rose-500/10 border-rose-500/40 text-[#0f172a] dark:text-white shadow-xs"
                    : "bg-[#f8fafc] dark:bg-[#161f30] border-[#e2e8f0] dark:border-[#223048] text-[#64748b] dark:text-slate-400"
                }`}
              >
                <input
                  type="radio"
                  name="clean_target"
                  checked={cleanTarget === "all_test_data"}
                  onChange={() => setCleanTarget("all_test_data")}
                  className="mt-0.5 accent-rose-500"
                />
                <div>
                  <span className="font-bold block text-[#0f172a] dark:text-white">
                    Clean All Non-Admin Data in Lower DB
                  </span>
                  <span className="text-[11px] text-[#64748b] dark:text-slate-400">
                    Completely resets users, submissions, and activities in <code className="text-rose-400">zap_platform_lower</code>.
                  </span>
                </div>
              </label>
            </div>

            {/* Guardrail Confirmation Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#334155] dark:text-slate-300">
                Type <span className="font-mono text-rose-400 font-bold">&quot;clean-lower&quot;</span> to confirm:
              </label>
              <input
                type="text"
                value={cleanConfirmText}
                onChange={(e) => setCleanConfirmText(e.target.value)}
                placeholder="clean-lower"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#161f30] border border-[#cbd5e1] dark:border-[#223048] text-[#0f172a] dark:text-white font-mono text-xs focus:outline-hidden focus:border-rose-500 shadow-xs"
              />
            </div>

            {cleanMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
                {cleanMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2e8f0] dark:border-[#1e293b]">
              <button
                type="button"
                onClick={() => setCleanModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#f1f5f9] dark:bg-slate-800 hover:bg-[#e2e8f0] dark:hover:bg-slate-700 text-[#0f172a] dark:text-slate-300 border border-[#cbd5e1] dark:border-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cleaningInProgress || cleanConfirmText.trim().toLowerCase() !== "clean-lower"}
                onClick={handleCleanData}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{cleaningInProgress ? "Purging..." : "Confirm & Purge Lower DB"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
