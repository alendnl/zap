import { ENVIRONMENT_HEADER, getEnvironment } from "./environment";
import { submissionsApi } from "./submissionsApi";

export interface CompilerRunRequest {
  language: string;
  sourceCode: string;
  stdin?: string;
  timeoutMs?: number;
}

export interface CompilerRunResult {
  status: "SUCCESS" | "COMPILE_ERROR" | "RUNTIME_ERROR" | "TIME_LIMIT_EXCEEDED" | "ERROR";
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut?: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

export const compilerApi = {
  async run(req: CompilerRunRequest): Promise<CompilerRunResult> {
    // 1. Attempt direct synchronous execution endpoint
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/api/v1/compiler/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [ENVIRONMENT_HEADER]: getEnvironment(),
          },
          body: JSON.stringify(req),
        });

        if (res.ok) {
          const data = await res.json();
          return {
            status: data.status || (data.exitCode === 0 ? "SUCCESS" : "RUNTIME_ERROR"),
            stdout: data.stdout || "",
            stderr: data.stderr || "",
            exitCode: data.exitCode ?? 0,
            executionTimeMs: data.executionTimeMs ?? 0,
            timedOut: data.timedOut ?? false,
          };
        }
      } catch (err) {
        console.warn("Direct compiler endpoint unavailable, falling back...", err);
      }
    }

    // 2. Fallback via submission runner on vanilla-compiler question
    try {
      const submission = await submissionsApi.create({
        questionId: "vanilla-compiler",
        language: req.language,
        mode: "RUN",
        sourceCode: req.sourceCode,
        userId: "guest-playground",
      });

      // Poll submission status until complete
      const startTime = Date.now();
      while (Date.now() - startTime < 15000) {
        await new Promise((r) => setTimeout(r, 600));
        const status = await submissionsApi.get(submission.submissionId);
        if (status.status === "COMPLETED" || status.status === "FAILED") {
          const tc = status.testResults?.[0];
          const hasError = status.verdict !== "ACCEPTED";
          return {
            status: hasError
              ? (status.verdict as any) || "ERROR"
              : "SUCCESS",
            stdout: tc?.actualOutput || "",
            stderr: tc?.error || status.compileOutput || status.errorMessage || "",
            exitCode: hasError ? 1 : 0,
            executionTimeMs: status.executionTimeMs || tc?.executionTimeMs || 0,
          };
        }
      }
      return {
        status: "TIME_LIMIT_EXCEEDED",
        stdout: "",
        stderr: "Execution timed out.",
        exitCode: 124,
        executionTimeMs: 15000,
        timedOut: true,
      };
    } catch (err: any) {
      return {
        status: "ERROR",
        stdout: "",
        stderr: err?.message || "Execution failed. Please check network connection.",
        exitCode: 1,
        executionTimeMs: 0,
      };
    }
  },
};
