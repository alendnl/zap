export type ZAPEnvironment = "qa" | "production";

export const ENVIRONMENT_HEADER = "X-ZAP-ENV";
export const ENVIRONMENT_CHANGE_EVENT = "zap:environment-change";
const STORAGE_KEY = "zap.environment";

export function getEnvironment(): ZAPEnvironment {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return stored === "qa" ? "qa" : "production";
}

export function setEnvironment(environment: ZAPEnvironment): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, environment);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ENVIRONMENT_CHANGE_EVENT));
  }
}
