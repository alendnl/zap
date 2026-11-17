export type TargetService = "api" | "executor" | "executor_spike";

export type RampUpStyle = "instant" | "gradual";

export type ExecutorMode = "compiler_run" | "full_submission";

export type SupportedLanguage = "cpp" | "java" | "python" | "c" | "javascript";

export type WorkloadComplexity = "light" | "medium" | "heavy";

export type SpikeStopMode = "requests" | "duration";

export interface ApiTestConfig {
  endpoints: string[];
  users: number;
  durationSeconds: number;
  rampUpStyle: RampUpStyle;
  spawnRate: number; // users added per second when gradual
  thinkTimeMs: number;
}

export interface ExecutorTestConfig {
  mode: ExecutorMode;
  users: number;
  submissionsPerUser: number;
  rampUpStyle: RampUpStyle;
  spawnRate: number;
  languages: SupportedLanguage[];
  complexity: WorkloadComplexity;
  thinkTimeMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
}

export interface ExecutorSpikeConfig {
  submissionsPerInterval: number; // e.g. 1 to 20
  intervalSeconds: number; // e.g. 0 to 5 seconds
  stopMode: SpikeStopMode; // "requests" | "duration"
  totalRequests: number; // e.g. 10 to 5000 (when stopMode === "requests")
  durationSeconds: number; // e.g. 5 to 600 (when stopMode === "duration")
  language: SupportedLanguage; // single language selected
  complexity: WorkloadComplexity;
}

export const DEFAULT_SPIKE_CONFIG: ExecutorSpikeConfig = {
  submissionsPerInterval: 2,
  intervalSeconds: 1,
  stopMode: "requests",
  totalRequests: 100,
  durationSeconds: 30,
  language: "python",
  complexity: "light",
};

export interface UnifiedLoadTestConfig {
  name: string;
  description?: string;
  targetService: TargetService;
  apiConfig: ApiTestConfig;
  executorConfig: ExecutorTestConfig;
  spikeConfig?: ExecutorSpikeConfig;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  vu: number;
  method: string;
  target: string;
  status: number;
  durationMs: number;
  message?: string;
  isError: boolean;
}

export interface TimelineMetric {
  time: number; // seconds
  rps: number;
  activeVUs: number;
  avgLatency: number;
  p95Latency: number;
  errors: number;
}

export interface EndpointMetricDetail {
  count: number;
  fails: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
}

export interface LanguageMetricDetail {
  count: number;
  fails: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
}

export type RunnerStatus = "IDLE" | "STARTING" | "RUNNING" | "PAUSED" | "COMPLETED" | "ABORTED";

export interface LiveMetrics {
  status: RunnerStatus;
  startedAt: number | null;
  elapsedSeconds: number;
  activeVirtualUsers: number;
  totalVirtualUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  currentRps: number;
  peakRps: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  statusCounts: Record<string, number>;
  endpointBreakdown: Record<string, EndpointMetricDetail>;
  languageBreakdown: Record<string, LanguageMetricDetail>;
  timeline: TimelineMetric[];
  recentLogs: LogEntry[];
}

export interface LoadTestRunReport {
  id?: string;
  configName: string;
  targetService: TargetService;
  status: "COMPLETED" | "ABORTED";
  startedAt: string;
  completedAt: string;
  summary: {
    totalTimeSeconds: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    successRate: number;
    overallRps: number;
    peakRps: number;
    statusCounts: Record<string, number>;
    latencyPercentiles: {
      min: number;
      avg: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
      max: number;
    };
    endpoints: Record<string, any>;
    languageBreakdown?: Record<string, any>;
  };
  testConfigSnapshot: UnifiedLoadTestConfig;
}
