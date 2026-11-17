import {
  UnifiedLoadTestConfig,
  LiveMetrics,
  LogEntry,
  RunnerStatus,
  TimelineMetric,
  LoadTestRunReport,
  EndpointMetricDetail,
  LanguageMetricDetail,
  SupportedLanguage,
  DEFAULT_SPIKE_CONFIG,
} from "./types";
import { SAMPLE_CODE_SNIPPETS } from "./sampleCodes";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (typeof window !== "undefined" && window.location.origin ? "" : "http://localhost:8000");

function formatTime(): string {
  const d = new Date();
  return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
}

function calculatePercentiles(durations: number[]) {
  if (!durations.length) {
    return { min: 0, avg: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const len = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);

  const getP = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * len), len - 1);
    return Math.round(sorted[idx] * 10) / 10;
  };

  return {
    min: Math.round(sorted[0] * 10) / 10,
    avg: Math.round((sum / len) * 10) / 10,
    p50: getP(50),
    p75: getP(75),
    p90: getP(90),
    p95: getP(95),
    p99: getP(99),
    max: Math.round(sorted[len - 1] * 10) / 10,
  };
}

export class LoadTestRunner {
  private config: UnifiedLoadTestConfig;
  private onUpdate: (metrics: LiveMetrics) => void;
  private onLog?: (log: LogEntry) => void;

  private status: RunnerStatus = "IDLE";
  private abortController: AbortController | null = null;
  private isPaused = false;
  private pausePromiseResolve: (() => void) | null = null;

  // Runtime Tracking
  private startTime: number = 0;
  private endTime: number = 0;
  private timerIntervalId: any = null;

  private allDurations: number[] = [];
  private recentWindowRequests: { timestamp: number; count: number }[] = [];
  private activeVUsCount = 0;
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private peakRps = 0;
  private statusCounts: Record<string, number> = {};
  private endpointDurations: Record<string, { durations: number[]; fails: number }> = {};
  private languageDurations: Record<string, { durations: number[]; fails: number }> = {};
  private timeline: TimelineMetric[] = [];
  private recentLogs: LogEntry[] = [];

  constructor(
    config: UnifiedLoadTestConfig,
    onUpdate: (metrics: LiveMetrics) => void,
    onLog?: (log: LogEntry) => void
  ) {
    this.config = config;
    this.onUpdate = onUpdate;
    this.onLog = onLog;
  }

  public getStatus(): RunnerStatus {
    return this.status;
  }

  public async start(): Promise<LoadTestRunReport> {
    if (this.status === "RUNNING") {
      throw new Error("Runner is already running");
    }

    this.status = "STARTING";
    this.abortController = new AbortController();
    this.isPaused = false;
    this.startTime = Date.now();
    this.endTime = 0;

    // Reset metrics
    this.allDurations = [];
    this.recentWindowRequests = [];
    this.activeVUsCount = 0;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.peakRps = 0;
    this.statusCounts = {};
    this.endpointDurations = {};
    this.languageDurations = {};
    this.timeline = [];
    this.recentLogs = [];

    this.addLog(0, "SYSTEM", "INFO", 200, 0, `Initializing load test for ${this.config.targetService.toUpperCase()}`);
    this.addLog(0, "SECURITY", "GUARDRAIL", 200, 0, "Strict Environment locked: X-ZAP-ENV: qa (zap_platform_lower)");

    // Start background ticker for RPS, timeline, and metric emissions
    this.startTicker();
    this.status = "RUNNING";

    try {
      if (this.config.targetService === "api") {
        await this.runApiTest();
      } else if (this.config.targetService === "executor_spike") {
        await this.runSpikeTest();
      } else {
        await this.runExecutorTest();
      }

      if ((this.status as RunnerStatus) !== "ABORTED") {
        this.status = "COMPLETED";
      }
    } catch (err: any) {
      if (err.name === "AbortError" || (this.status as RunnerStatus) === "ABORTED") {
        this.status = "ABORTED";
        this.addLog(0, "SYSTEM", "ABORT", 499, 0, "Load test aborted by user");
      } else {
        this.status = "COMPLETED";
        this.addLog(0, "SYSTEM", "ERROR", 500, 0, `Run finished with error: ${err.message}`);
      }
    } finally {
      this.endTime = Date.now();
      this.stopTicker();
      this.emitMetrics();
    }

    return this.buildReport();
  }

  public pause(): void {
    if (this.status === "RUNNING") {
      this.status = "PAUSED";
      this.isPaused = true;
      this.addLog(0, "SYSTEM", "PAUSE", 200, 0, "Execution paused by user");
      this.emitMetrics();
    }
  }

  public resume(): void {
    if (this.status === "PAUSED") {
      this.status = "RUNNING";
      this.isPaused = false;
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
      this.addLog(0, "SYSTEM", "RESUME", 200, 0, "Execution resumed");
      this.emitMetrics();
    }
  }

  public abort(): void {
    if (this.status === "RUNNING" || this.status === "PAUSED") {
      this.status = "ABORTED";
      if (this.abortController) {
        this.abortController.abort();
      }
      if (this.pausePromiseResolve) {
        this.pausePromiseResolve();
        this.pausePromiseResolve = null;
      }
      this.stopTicker();
      this.emitMetrics();
    }
  }

  // ---------------------------------------------------------------------------
  // RUNNER LOGIC: API TEST
  // ---------------------------------------------------------------------------
  private async runApiTest(): Promise<void> {
    const { users, durationSeconds, rampUpStyle, spawnRate, thinkTimeMs, endpoints } =
      this.config.apiConfig;

    const testDurationMs = durationSeconds * 1000;
    const testEndTime = this.startTime + testDurationMs;

    const vuPromises: Promise<void>[] = [];
    const spawnDelayMs = rampUpStyle === "gradual" && spawnRate > 0 ? 1000 / spawnRate : 0;

    for (let i = 1; i <= users; i++) {
      if (this.abortController?.signal.aborted) break;

      const vuIndex = i;
      const vuPromise = (async () => {
        if (spawnDelayMs > 0 && vuIndex > 1) {
          await this.sleep(spawnDelayMs * (vuIndex - 1));
        }
        if (this.abortController?.signal.aborted) return;

        this.activeVUsCount++;
        this.emitMetrics();

        try {
          while (Date.now() < testEndTime && !this.abortController?.signal.aborted) {
            await this.checkPause();
            if (this.abortController?.signal.aborted) break;

            const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)] || "/api/v1/questions";
            await this.executeApiRequest(vuIndex, endpoint);

            if (thinkTimeMs > 0 && !this.abortController?.signal.aborted) {
              await this.sleep(thinkTimeMs);
            }
          }
        } finally {
          this.activeVUsCount = Math.max(0, this.activeVUsCount - 1);
          this.emitMetrics();
        }
      })();

      vuPromises.push(vuPromise);
    }

    await Promise.all(vuPromises);
  }

  private async executeApiRequest(vu: number, endpoint: string): Promise<void> {
    const t0 = performance.now();
    let status = 0;
    let isError = false;
    let errorMsg = "";

    try {
      let url = `${API_BASE}${endpoint}`;
      let method = "GET";
      let body: any = undefined;

      // Handle synthetic signup workload
      if (endpoint === "/api/v1/auth/signup") {
        method = "POST";
        const hex = Math.random().toString(16).substring(2, 8);
        body = JSON.stringify({
          name: `LoadTest Student ${hex}`,
          studentId: `LT-${hex}`,
          collegeName: "Load Test College",
          email: `loadtest_${hex}@codezap.test`,
          password: "Password123!",
        });
      }

      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      // STRICT ENVIRONMENT GUARDRAIL
      headers.set("X-ZAP-ENV", "qa");

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: this.abortController?.signal,
      });

      status = response.status;
      isError = !response.ok;
      if (isError) {
        errorMsg = `HTTP ${status} ${response.statusText}`;
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      status = 599;
      isError = true;
      errorMsg = err.message || "Network Error";
    }

    const duration = Math.round(performance.now() - t0);
    this.recordRequestMetric(endpoint, status, duration, isError);
    this.addLog(vu, "API", endpoint, status, duration, errorMsg, isError);
  }

  // ---------------------------------------------------------------------------
  // RUNNER LOGIC: EXECUTOR TEST
  // ---------------------------------------------------------------------------
  private async runExecutorTest(): Promise<void> {
    const {
      mode,
      users,
      submissionsPerUser,
      rampUpStyle,
      spawnRate,
      languages,
      complexity,
      thinkTimeMs,
      pollIntervalMs,
      maxPollAttempts,
    } = this.config.executorConfig;

    const vuPromises: Promise<void>[] = [];
    const spawnDelayMs = rampUpStyle === "gradual" && spawnRate > 0 ? 1000 / spawnRate : 0;

    for (let i = 1; i <= users; i++) {
      if (this.abortController?.signal.aborted) break;

      const vuIndex = i;
      const vuPromise = (async () => {
        if (spawnDelayMs > 0 && vuIndex > 1) {
          await this.sleep(spawnDelayMs * (vuIndex - 1));
        }
        if (this.abortController?.signal.aborted) return;

        this.activeVUsCount++;
        this.emitMetrics();

        try {
          if (mode === "compiler_run") {
            // Direct Synchronous Compiler Stress Test
            for (let sub = 1; sub <= submissionsPerUser; sub++) {
              await this.checkPause();
              if (this.abortController?.signal.aborted) break;

              const lang = languages[Math.floor(Math.random() * languages.length)] || "python";
              await this.executeCompilerRun(vuIndex, lang, complexity);

              if (thinkTimeMs > 0 && sub < submissionsPerUser && !this.abortController?.signal.aborted) {
                await this.sleep(thinkTimeMs);
              }
            }
          } else {
            // Full Asynchronous Submission Lifecycle
            await this.executeFullSubmissionUser(
              vuIndex,
              submissionsPerUser,
              languages,
              complexity,
              thinkTimeMs,
              pollIntervalMs,
              maxPollAttempts
            );
          }
        } finally {
          this.activeVUsCount = Math.max(0, this.activeVUsCount - 1);
          this.emitMetrics();
        }
      })();

      vuPromises.push(vuPromise);
    }

    await Promise.all(vuPromises);
  }

  private async executeCompilerRun(
    vu: number,
    language: SupportedLanguage,
    complexity: string
  ): Promise<void> {
    const snippet =
      SAMPLE_CODE_SNIPPETS[language]?.[complexity as "light" | "medium" | "heavy"] ||
      SAMPLE_CODE_SNIPPETS.python.light;

    const t0 = performance.now();
    let status = 0;
    let isError = false;
    let verdict = "";

    try {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      // STRICT ENVIRONMENT GUARDRAIL
      headers.set("X-ZAP-ENV", "qa");

      const res = await fetch(`${API_BASE}/api/v1/compiler/run`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          language,
          sourceCode: snippet.sourceCode,
          stdin: snippet.stdin,
          timeoutMs: 5000,
          memoryMb: 256,
        }),
        signal: this.abortController?.signal,
      });

      status = res.status;
      if (res.ok) {
        const data = await res.json();
        verdict = data.status || "SUCCESS";
        if (verdict !== "SUCCESS") {
          isError = true;
        }
      } else {
        isError = true;
        verdict = `HTTP ${status}`;
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      status = 599;
      isError = true;
      verdict = err.message || "Network Error";
    }

    const duration = Math.round(performance.now() - t0);
    this.recordRequestMetric(`/api/v1/compiler/run [${language.toUpperCase()}]`, status, duration, isError, language);
    this.addLog(
      vu,
      "EXECUTOR",
      `POST /api/v1/compiler/run (${language})`,
      status,
      duration,
      `Verdict: ${verdict}`,
      isError
    );
  }

  private async executeFullSubmissionUser(
    vu: number,
    submissionsCount: number,
    languages: SupportedLanguage[],
    complexity: string,
    thinkTimeMs: number,
    pollIntervalMs: number,
    maxPollAttempts: number
  ): Promise<void> {
    // 1. Authenticate synthetic user in QA DB
    const hex = `${vu}_${Math.random().toString(16).substring(2, 7)}`;
    const email = `loadtest_vu_${hex}@codezap.test`;
    const password = "Password123!";
    let token = "";
    let userId = "";

    const t0 = performance.now();
    try {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("X-ZAP-ENV", "qa");

      const authRes = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `LoadTest VU ${vu}`,
          studentId: `LT-${hex}`,
          collegeName: "Load Test Institute",
          email,
          password,
        }),
        signal: this.abortController?.signal,
      });

      const authDur = Math.round(performance.now() - t0);
      this.recordRequestMetric("POST /api/v1/auth/signup", authRes.status, authDur, !authRes.ok);
      if (authRes.ok) {
        const authData = await authRes.json();
        token = authData.token;
        userId = authData.student?.id;
        this.addLog(vu, "AUTH", "POST /api/v1/auth/signup", authRes.status, authDur, `Signed up: ${email}`, false);
      } else {
        this.addLog(vu, "AUTH", "POST /api/v1/auth/signup", authRes.status, authDur, "Signup failed", true);
        return;
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      return;
    }

    // 2. Perform Submissions
    for (let sub = 1; sub <= submissionsCount; sub++) {
      await this.checkPause();
      if (this.abortController?.signal.aborted) break;

      const lang = languages[Math.floor(Math.random() * languages.length)] || "python";
      const snippet =
        SAMPLE_CODE_SNIPPETS[lang]?.[complexity as "light" | "medium" | "heavy"] ||
        SAMPLE_CODE_SNIPPETS.python.light;

      let submissionId = "";
      const tSub = performance.now();
      try {
        const headers = new Headers();
        headers.set("Content-Type", "application/json");
        headers.set("X-ZAP-ENV", "qa");
        headers.set("Authorization", `Bearer ${token}`);

        const subRes = await fetch(`${API_BASE}/api/v1/submissions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            questionId: "q-49c9f560",
            language: lang,
            mode: "SUBMIT",
            sourceCode: snippet.sourceCode,
            userId,
          }),
          signal: this.abortController?.signal,
        });

        const subDur = Math.round(performance.now() - tSub);
        const subOk = subRes.status === 202;
        this.recordRequestMetric("POST /api/v1/submissions", subRes.status, subDur, !subOk, lang);

        if (subOk) {
          const subData = await subRes.json();
          submissionId = subData.submissionId;
          this.addLog(
            vu,
            "SUBMIT",
            `POST /api/v1/submissions (${lang})`,
            subRes.status,
            subDur,
            `Enqueued: ${submissionId}`,
            false
          );
        } else {
          this.addLog(
            vu,
            "SUBMIT",
            `POST /api/v1/submissions (${lang})`,
            subRes.status,
            subDur,
            `Submission error: ${subRes.status}`,
            true
          );
          continue;
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        continue;
      }

      // 3. Poll for terminal verdict
      if (submissionId) {
        for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
          await this.checkPause();
          if (this.abortController?.signal.aborted) break;

          await this.sleep(pollIntervalMs);
          if (this.abortController?.signal.aborted) break;

          const tPoll = performance.now();
          try {
            const headers = new Headers();
            headers.set("X-ZAP-ENV", "qa");
            headers.set("Authorization", `Bearer ${token}`);

            const pollRes = await fetch(`${API_BASE}/api/v1/submissions/${submissionId}`, {
              headers,
              signal: this.abortController?.signal,
            });

            const pollDur = Math.round(performance.now() - tPoll);
            this.recordRequestMetric("GET /api/v1/submissions/{id}", pollRes.status, pollDur, !pollRes.ok);

            if (pollRes.ok) {
              const pollData = await pollRes.json();
              const pollStatus = pollData.status;
              if (pollStatus === "COMPLETED" || pollStatus === "FAILED") {
                this.addLog(
                  vu,
                  "POLL",
                  `GET /api/v1/submissions/${submissionId}`,
                  pollRes.status,
                  pollDur,
                  `Status: ${pollStatus} | Verdict: ${pollData.verdict || "N/A"}`,
                  false
                );
                break;
              }
            }
          } catch (err: any) {
            if (err.name === "AbortError") return;
            break;
          }
        }
      }

      if (thinkTimeMs > 0 && sub < submissionsCount && !this.abortController?.signal.aborted) {
        await this.sleep(thinkTimeMs);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // METRICS & TICKER
  // ---------------------------------------------------------------------------
  private recordRequestMetric(
    endpoint: string,
    status: number,
    durationMs: number,
    isError: boolean,
    language?: string
  ): void {
    this.totalRequests++;
    if (isError || status >= 400) {
      this.failedRequests++;
    } else {
      this.successfulRequests++;
    }

    this.allDurations.push(durationMs);
    const statusKey = String(status);
    this.statusCounts[statusKey] = (this.statusCounts[statusKey] || 0) + 1;

    // Window for RPS computation
    this.recentWindowRequests.push({ timestamp: Date.now(), count: 1 });

    // Endpoint breakdown
    if (!this.endpointDurations[endpoint]) {
      this.endpointDurations[endpoint] = { durations: [], fails: 0 };
    }
    this.endpointDurations[endpoint].durations.push(durationMs);
    if (isError || status >= 400) {
      this.endpointDurations[endpoint].fails++;
    }

    // Language breakdown if applicable
    if (language) {
      if (!this.languageDurations[language]) {
        this.languageDurations[language] = { durations: [], fails: 0 };
      }
      this.languageDurations[language].durations.push(durationMs);
      if (isError || status >= 400) {
        this.languageDurations[language].fails++;
      }
    }
  }

  private startTicker(): void {
    this.timerIntervalId = setInterval(() => {
      const now = Date.now();
      // Purge requests older than 1 second from window
      this.recentWindowRequests = this.recentWindowRequests.filter((r) => now - r.timestamp <= 1000);
      const currentRps = this.recentWindowRequests.reduce((acc, r) => acc + r.count, 0);
      if (currentRps > this.peakRps) {
        this.peakRps = currentRps;
      }

      const elapsed = Math.max(0, Math.round((now - this.startTime) / 1000));
      const p = calculatePercentiles(this.allDurations);

      // Record timeline slice (at most 1 per second)
      const lastTick = this.timeline[this.timeline.length - 1];
      if (!lastTick || lastTick.time !== elapsed) {
        this.timeline.push({
          time: elapsed,
          rps: currentRps,
          activeVUs: this.activeVUsCount,
          avgLatency: p.avg,
          p95Latency: p.p95,
          errors: this.failedRequests,
        });
        if (this.timeline.length > 300) {
          this.timeline.shift();
        }
      }

      this.emitMetrics();
    }, 500);
  }

  private stopTicker(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  private addLog(
    vu: number,
    method: string,
    target: string,
    status: number,
    durationMs: number,
    message?: string,
    isError = false
  ): void {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: formatTime(),
      vu,
      method,
      target,
      status,
      durationMs,
      message,
      isError,
    };
    this.recentLogs.push(entry);
    if (this.recentLogs.length > 100) {
      this.recentLogs.shift();
    }
    if (this.onLog) {
      this.onLog(entry);
    }
  }

  private emitMetrics(): void {
    const now = Date.now();
    const elapsed = this.startTime ? Math.max(1, (now - this.startTime) / 1000) : 1;
    const p = calculatePercentiles(this.allDurations);
    const successRate =
      this.totalRequests > 0
        ? Math.round((this.successfulRequests / this.totalRequests) * 1000) / 10
        : 100;

    const endpointBreakdown: Record<string, EndpointMetricDetail> = {};
    for (const [ep, data] of Object.entries(this.endpointDurations)) {
      const epP = calculatePercentiles(data.durations);
      endpointBreakdown[ep] = {
        count: data.durations.length,
        fails: data.fails,
        avgMs: epP.avg,
        minMs: epP.min,
        maxMs: epP.max,
        p50Ms: epP.p50,
        p95Ms: epP.p95,
      };
    }

    const languageBreakdown: Record<string, LanguageMetricDetail> = {};
    for (const [lang, data] of Object.entries(this.languageDurations)) {
      const langP = calculatePercentiles(data.durations);
      languageBreakdown[lang] = {
        count: data.durations.length,
        fails: data.fails,
        avgMs: langP.avg,
        minMs: langP.min,
        maxMs: langP.max,
        p50Ms: langP.p50,
        p95Ms: langP.p95,
      };
    }

    const currentRps = this.recentWindowRequests.reduce((acc, r) => acc + r.count, 0);

    const totalVUs =
      this.config.targetService === "api" ? this.config.apiConfig.users : this.config.executorConfig.users;

    this.onUpdate({
      status: this.status,
      startedAt: this.startTime,
      elapsedSeconds: Math.round(elapsed),
      activeVirtualUsers: this.activeVUsCount,
      totalVirtualUsers: totalVUs,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate,
      currentRps,
      peakRps: this.peakRps,
      avgLatencyMs: p.avg,
      minLatencyMs: p.min,
      maxLatencyMs: p.max,
      p50LatencyMs: p.p50,
      p90LatencyMs: p.p90,
      p95LatencyMs: p.p95,
      p99LatencyMs: p.p99,
      statusCounts: { ...this.statusCounts },
      endpointBreakdown,
      languageBreakdown,
      timeline: [...this.timeline],
      recentLogs: [...this.recentLogs],
    });
  }

  private buildReport(): LoadTestRunReport {
    const totalTimeSec = this.startTime && this.endTime ? (this.endTime - this.startTime) / 1000 : 0;
    const p = calculatePercentiles(this.allDurations);
    const successRate =
      this.totalRequests > 0
        ? Math.round((this.successfulRequests / this.totalRequests) * 1000) / 10
        : 100;
    const overallRps = totalTimeSec > 0 ? Math.round((this.totalRequests / totalTimeSec) * 10) / 10 : 0;

    const endpointBreakdown: Record<string, any> = {};
    for (const [ep, data] of Object.entries(this.endpointDurations)) {
      const epP = calculatePercentiles(data.durations);
      endpointBreakdown[ep] = {
        count: data.durations.length,
        fails: data.fails,
        avg_ms: epP.avg,
        min_ms: epP.min,
        max_ms: epP.max,
        p50_ms: epP.p50,
        p90_ms: epP.p90,
        p95_ms: epP.p95,
        p99_ms: epP.p99,
      };
    }

    const languageBreakdown: Record<string, any> = {};
    for (const [lang, data] of Object.entries(this.languageDurations)) {
      const langP = calculatePercentiles(data.durations);
      languageBreakdown[lang] = {
        count: data.durations.length,
        fails: data.fails,
        avg_ms: langP.avg,
        min_ms: langP.min,
        max_ms: langP.max,
        p50_ms: langP.p50,
        p90_ms: langP.p90,
        p95_ms: langP.p95,
        p99_ms: langP.p99,
      };
    }

    return {
      configName: this.config.name,
      targetService: this.config.targetService,
      status: this.status === "ABORTED" ? "ABORTED" : "COMPLETED",
      startedAt: new Date(this.startTime).toISOString(),
      completedAt: new Date(this.endTime || Date.now()).toISOString(),
      summary: {
        totalTimeSeconds: Math.round(totalTimeSec * 10) / 10,
        totalRequests: this.totalRequests,
        successfulRequests: this.successfulRequests,
        failedRequests: this.failedRequests,
        successRate,
        overallRps,
        peakRps: this.peakRps,
        statusCounts: { ...this.statusCounts },
        latencyPercentiles: p,
        endpoints: endpointBreakdown,
        languageBreakdown: Object.keys(languageBreakdown).length > 0 ? languageBreakdown : undefined,
      },
      testConfigSnapshot: JSON.parse(JSON.stringify(this.config)),
    };
  }

  private async checkPause(): Promise<void> {
    if (!this.isPaused) return;
    await new Promise<void>((resolve) => {
      this.pausePromiseResolve = resolve;
    });
  }

  // ---------------------------------------------------------------------------
  // RUNNER LOGIC: EXECUTOR SPIKE (SUSTAINED PULSE BENCHMARK)
  // ---------------------------------------------------------------------------
  private async runSpikeTest(): Promise<void> {
    const spikeConfig = this.config.spikeConfig || DEFAULT_SPIKE_CONFIG;
    const {
      submissionsPerInterval = 2,
      intervalSeconds = 1.0,
      stopMode = "requests",
      totalRequests = 100,
      durationSeconds = 30,
      language = "python",
      complexity = "light",
    } = spikeConfig;

    const startTime = Date.now();
    const durationMs = (durationSeconds || 30) * 1000;
    const targetRequests = totalRequests || 100;
    let sentRequests = 0;
    let batchIndex = 0;

    this.addLog(
      1,
      "SPIKE",
      `INIT SPIKE: ${submissionsPerInterval} reqs / ${intervalSeconds}s | Stop: ${stopMode === "requests" ? targetRequests + " reqs" : durationSeconds + "s"} | Lang: ${language.toUpperCase()}`,
      200,
      0,
      "Direct zap-executor sustained pulse initialized.",
      false
    );

    // 1. One-time authentication to get a valid synthetic user/token in QA database
    const authHex = `spk_${Math.random().toString(16).substring(2, 7)}`;
    const email = `spike_runner_${authHex}@codezap.test`;
    let token = "";
    let userId = "";

    try {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("X-ZAP-ENV", "qa");

      const authRes = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Spike Runner",
          studentId: `SPK-${authHex}`,
          collegeName: "Spike Test Institute",
          email,
          password: "Password123!",
        }),
        signal: this.abortController?.signal,
      });

      if (authRes.ok) {
        const authData = await authRes.json();
        token = authData.token;
        userId = authData.student?.id;
        this.addLog(1, "AUTH", "POST /api/v1/auth/signup", authRes.status, 0, `Spike session authenticated: ${email}`, false);
      }
    } catch (authErr: any) {
      if (authErr.name === "AbortError") return;
    }

    const snippet =
      SAMPLE_CODE_SNIPPETS[language]?.[complexity as "light" | "medium" | "heavy"] ||
      SAMPLE_CODE_SNIPPETS.python.light;

    this.activeVUsCount = submissionsPerInterval;
    this.emitMetrics();

    const activeBackgroundTasks: Promise<void>[] = [];

    // 2. Pulse loop
    while (!this.abortController?.signal.aborted) {
      await this.checkPause();
      if (this.abortController?.signal.aborted) break;

      const elapsed = Date.now() - startTime;
      if (stopMode === "duration" && elapsed >= durationMs) {
        this.addLog(1, "SYSTEM", "INFO", 200, 0, `Duration limit reached (${durationSeconds}s)`);
        break;
      }
      if (stopMode === "requests" && sentRequests >= targetRequests) {
        this.addLog(1, "SYSTEM", "INFO", 200, 0, `Target request count reached (${targetRequests} submissions)`);
        break;
      }

      batchIndex++;
      let currentBatchSize = submissionsPerInterval;
      if (stopMode === "requests") {
        currentBatchSize = Math.min(submissionsPerInterval, targetRequests - sentRequests);
      }

      if (currentBatchSize <= 0) break;

      // Dispatch this pulse batch concurrently
      const batchPromises = [];
      for (let s = 1; s <= currentBatchSize; s++) {
        const subIndex = sentRequests + s;
        const subUserId = `${userId || "spike"}_${subIndex}_${Math.random().toString(36).substring(2, 6)}`;
        batchPromises.push(
          this.sendSpikeSubmission(subIndex, language, snippet.sourceCode, subUserId, token, activeBackgroundTasks)
        );
      }

      sentRequests += currentBatchSize;
      this.emitMetrics();

      await Promise.all(batchPromises);

      if (this.abortController?.signal.aborted) break;

      const nextElapsed = Date.now() - startTime;
      if (stopMode === "duration" && nextElapsed >= durationMs) break;
      if (stopMode === "requests" && sentRequests >= targetRequests) break;

      if (intervalSeconds > 0) {
        await this.sleep(intervalSeconds * 1000);
      }
    }

    // Grace period for active background polls
    if (activeBackgroundTasks.length > 0 && !this.abortController?.signal.aborted) {
      this.addLog(1, "SYSTEM", "INFO", 200, 0, `Awaiting ${activeBackgroundTasks.length} pending executions to finalize...`);
      await Promise.race([
        Promise.all(activeBackgroundTasks),
        this.sleep(8000),
      ]);
    }

    this.activeVUsCount = 0;
    this.emitMetrics();
  }

  private async sendSpikeSubmission(
    reqIndex: number,
    language: SupportedLanguage,
    sourceCode: string,
    subUserId: string,
    token: string,
    activeTasks: Promise<void>[]
  ): Promise<void> {
    const t0 = performance.now();
    let status = 0;
    let isError = false;

    try {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("X-ZAP-ENV", "qa");
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API_BASE}/api/v1/submissions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          questionId: "q-49c9f560",
          language,
          mode: "SUBMIT",
          sourceCode,
          userId: subUserId,
        }),
        signal: this.abortController?.signal,
      });

      status = res.status;
      isError = !res.ok;
      const duration = Math.round(performance.now() - t0);
      this.recordRequestMetric("POST /api/v1/submissions", status, duration, isError, language);

      if (res.ok) {
        const data = await res.json();
        const submissionId = data.submissionId;
        this.addLog(
          reqIndex,
          "SPIKE",
          `POST /api/v1/submissions (${language.toUpperCase()})`,
          status,
          duration,
          `Enqueued: ${submissionId} [#${reqIndex}]`,
          false
        );

        const pollTask = this.pollSpikeSubmission(submissionId, token, reqIndex, language);
        activeTasks.push(pollTask);
      } else {
        this.addLog(
          reqIndex,
          "SPIKE",
          `POST /api/v1/submissions (${language.toUpperCase()})`,
          status,
          duration,
          `Enqueue error: ${status}`,
          true
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      const duration = Math.round(performance.now() - t0);
      this.recordRequestMetric("POST /api/v1/submissions", 599, duration, true, language);
      this.addLog(
        reqIndex,
        "SPIKE",
        `POST /api/v1/submissions (${language.toUpperCase()})`,
        599,
        duration,
        err.message || "Network Error",
        true
      );
    }
  }

  private async pollSpikeSubmission(
    submissionId: string,
    token: string,
    reqIndex: number,
    language: SupportedLanguage
  ): Promise<void> {
    const tStart = performance.now();
    for (let attempt = 1; attempt <= 25; attempt++) {
      if (this.abortController?.signal.aborted) break;
      await this.sleep(1000);
      if (this.abortController?.signal.aborted) break;

      try {
        const headers = new Headers();
        headers.set("X-ZAP-ENV", "qa");
        if (token) headers.set("Authorization", `Bearer ${token}`);

        const pollRes = await fetch(`${API_BASE}/api/v1/submissions/${submissionId}`, {
          headers,
          signal: this.abortController?.signal,
        });

        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.status === "COMPLETED" || pollData.status === "FAILED") {
            const execDuration = Math.round(performance.now() - tStart);
            this.recordRequestMetric("GET /api/v1/submissions/{id}", pollRes.status, execDuration, pollData.status === "FAILED", language);
            this.addLog(
              reqIndex,
              "EXECUTOR",
              `SUBMISSION COMPLETE: ${pollData.verdict || pollData.status}`,
              pollRes.status,
              execDuration,
              `ID: ${submissionId} | Lang: ${language} | Time: ${pollData.executionTimeMs ?? 0}ms`,
              pollData.status === "FAILED"
            );
            break;
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") break;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.abortController?.signal.aborted) {
        return resolve();
      }
      let timer: any;
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      timer = setTimeout(() => {
        this.abortController?.signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      this.abortController?.signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
