"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Trophy,
  Clock,
  BookOpen,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  User,
  Mail,
  LogIn,
} from "lucide-react";
import { contestApi } from "@/services/contestApi";
import { getStoredStudent, setStoredStudent } from "@/services/authApi";
import { ContestArena } from "@/components/ContestArena";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Student } from "@/types/auth";
import type { Contest, ContestStartResponse } from "@/types/contest";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function DedicatedContestPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [student, setStudent] = useState<Student | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [loadingContest, setLoadingContest] = useState(true);
  const [contestError, setContestError] = useState<string | null>(null);

  // Guest / Candidate registration modal if not logged in
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCollege, setGuestCollege] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);

  // Active session
  const [activeSession, setActiveSession] = useState<ContestStartResponse | null>(null);
  const [startingSession, setStartingSession] = useState(false);

  // Load authenticated student
  useEffect(() => {
    const current = getStoredStudent();
    if (current) {
      setStudent(current);
    }
  }, []);

  // Fetch contest metadata by slug
  const loadContest = useCallback(async () => {
    if (!slug) return;
    setLoadingContest(true);
    setContestError(null);
    try {
      const data = await contestApi.get(slug);
      setContest(data);
    } catch (err: any) {
      setContestError(err.message || `Contest "${slug}" not found.`);
    } finally {
      setLoadingContest(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadContest();
  }, [loadContest]);

  // Handle guest candidate registration
  const handleSaveCandidateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);

    const trimmedName = guestName.trim();
    const trimmedEmail = guestEmail.trim().toLowerCase();

    if (!trimmedName) {
      setGuestError("Please enter your full name.");
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setGuestError("Please enter a valid email address.");
      return;
    }

    const newStudent: Student = {
      id: `student-${Date.now().toString(36)}`,
      name: trimmedName,
      email: trimmedEmail,
      collegeName: guestCollege.trim() || "Independent Candidate",
      studentId: `cand-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    setStoredStudent(newStudent);
    setStudent(newStudent);
  };

  // Start Assessment
  const handleStartAssessment = async () => {
    if (!contest) return;

    const studentId = student?.id || (student as any)?._id || student?.studentId || "student-anonymous";
    const studentEmail = student?.email;
    const studentName = student?.name;

    setStartingSession(true);
    try {
      const session = await contestApi.start(
        contest.id || contest.slug,
        studentId,
        studentEmail,
        studentName
      );
      setActiveSession(session);
    } catch (err: any) {
      alert(err.message || "Failed to initialize contest session. Please check your network connection.");
    } finally {
      setStartingSession(false);
    }
  };

  // If in an active session (or viewing completed results), render ContestArena
  if (activeSession && contest) {
    const studentId = student?.id || (student as any)?._id || student?.studentId || "student-anonymous";
    return (
      <ContestArena
        contest={activeSession.contest || contest}
        mcqQuestions={activeSession.mcqQuestions || []}
        codingQuestions={activeSession.codingQuestions || []}
        studentId={studentId}
        studentEmail={student?.email}
        studentName={student?.name}
        initialSession={activeSession}
        onExit={() => {
          setActiveSession(null);
          void loadContest();
        }}
      />
    );
  }

  // Loading state
  if (loadingContest) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold animate-pulse shadow-lg mb-4">
          Z
        </div>
        <p className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span>Loading assessment environment...</span>
        </p>
      </div>
    );
  }

  // Error / Not Found state
  if (contestError || !contest) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-3xl max-w-md w-full p-8 text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-white">Contest Not Found</h2>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
            {contestError || `We couldn't find an assessment matching "${slug}". It may have been unpublished or removed.`}
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link
              href="/?tab=contest"
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors text-center"
            >
              View Active Contests
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white text-center"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const mcqCount = contest.mcqConfig?.totalQuestions ?? (contest.hasMcq ? 25 : 0);
  const codingCount = contest.codingConfig?.totalQuestions ?? (contest.hasCoding ? 3 : 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b0f17] text-[#0f172a] dark:text-[#f8fafc] flex flex-col transition-colors duration-200">
      {/* Top Bar */}
      <header className="border-b border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/?tab=contest"
            className="flex items-center gap-1.5 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">All Contests</span>
          </Link>
          <div className="h-4 w-px bg-[#e2e8f0] dark:border-[#1e293b]" />
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-[11px]">
              Z
            </span>
            <span className="font-bold text-[#0f172a] dark:text-white">Assessment Arena</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {student ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-[#1a2233] text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-semibold max-w-[140px] truncate">{student.name}</span>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-500/30 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 sm:py-12 w-full space-y-6">
        {/* Contest Header Card */}
        <div className="bg-white dark:bg-[#121824] border border-[#e2e8f0] dark:border-[#1e293b] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono uppercase tracking-wide">
              {contest.status} Assessment
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold font-mono">
              <Clock className="w-3 h-3 inline mr-1" />
              {contest.durationMinutes} Minutes Duration
            </span>
            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold font-mono">
              <Trophy className="w-3 h-3 inline mr-1" />
              {contest.totalPoints} Total Marks
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tight">
              {contest.title}
            </h1>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-2 leading-relaxed whitespace-pre-line">
              {contest.description}
            </p>
          </div>

          {/* Assessment Section Blueprint */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold font-mono text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider">
              Sections in this Assessment:
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contest.hasMcq && (
                <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                      Section 1: Conceptual Multiple Choice
                    </h4>
                    <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                      {mcqCount} questions testing data structures, algorithms, and fundamental computer science concepts.
                    </p>
                  </div>
                </div>
              )}

              {contest.hasCoding && (
                <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-[#0f172a] dark:text-white">
                      Section 2: Hands-on Judge Challenges
                    </h4>
                    <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] leading-relaxed">
                      {codingCount} algorithm problems embedded directly in the Monaco code editor with real-time testcase execution.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Proctoring & Integrity Checklist */}
          <div className="p-4 rounded-2xl bg-[#f8fafc] dark:bg-[#0b0f17] border border-[#e2e8f0] dark:border-[#1e293b] text-xs space-y-2 text-[#64748b] dark:text-[#94a3b8]">
            <div className="flex items-center gap-2 font-bold text-[#0f172a] dark:text-white">
              <ShieldAlert className="w-4 h-4 text-purple-500" />
              <span>Assessment Guidelines & Proctoring Policy</span>
            </div>
            <ul className="space-y-1.5 pl-6 list-disc text-[11px]">
              <li>The timer starts immediately when you click <strong>"Enter Assessment"</strong>.</li>
              <li>Assessment must be completed in continuous <strong>Fullscreen Mode</strong>.</li>
              <li>Switching tabs, copying questions, or window blurring events are recorded and flagged.</li>
              <li>Your progress and code drafts are synchronized automatically.</li>
            </ul>
          </div>

          {/* Student Profile Gate or Start Action */}
          {!student ? (
            <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Candidate Identification Required
                </h4>
                <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                  Please enter your details below so your test attempt and scorecard can be saved properly.
                </p>
              </div>

              {guestError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                  {guestError}
                </div>
              )}

              <form onSubmit={handleSaveCandidateProfile} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">
                    FULL NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">
                    EMAIL ADDRESS *
                  </label>
                  <input
                    type="email"
                    required
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="john@college.edu"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold text-[#64748b] dark:text-[#94a3b8] mb-1">
                    COLLEGE / BATCH
                  </label>
                  <input
                    type="text"
                    value={guestCollege}
                    onChange={(e) => setGuestCollege(e.target.value)}
                    placeholder="e.g. IIT Madras"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#e2e8f0] dark:border-[#1e293b] bg-white dark:bg-[#121824] text-[#0f172a] dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md cursor-pointer transition-all"
                  >
                    Save & Continue to Assessment
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#e2e8f0] dark:border-[#1e293b]">
              <div className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                Participating as: <strong className="text-[#0f172a] dark:text-white">{student.name}</strong> ({student.email})
              </div>

              <button
                type="button"
                disabled={startingSession}
                onClick={handleStartAssessment}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50 transition-all active:scale-98"
              >
                {startingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Environment...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Enter Assessment Now</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
