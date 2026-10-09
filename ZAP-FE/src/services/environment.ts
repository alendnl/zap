export type ZAPEnvironment = "qa" | "production";

export const ENVIRONMENT_HEADER = "X-ZAP-ENV";
export const ENVIRONMENT_CHANGE_EVENT = "zap:environment-change";
const STORAGE_KEY = "zap.environment";

/**
 * Config-based toggle for the QA environment switcher.
 * Set to true when testing QA. Currently turned OFF.
 */
export const ENABLE_QA_ENVIRONMENT: boolean =
  process.env.NEXT_PUBLIC_ENABLE_QA_ENV === "true" || false;

export function getEnvironment(): ZAPEnvironment {
  if (!ENABLE_QA_ENVIRONMENT) {
    return "production";
  }
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return stored === "qa" ? "qa" : "production";
}

export function setEnvironment(environment: ZAPEnvironment): void {
  if (!ENABLE_QA_ENVIRONMENT) return;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, environment);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENVIRONMENT_CHANGE_EVENT));
  }
}

