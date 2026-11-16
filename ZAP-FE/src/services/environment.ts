export type ZAPEnvironment = "qa" | "production";

export const ENVIRONMENT_HEADER = "X-ZAP-ENV";
export const ENVIRONMENT_CHANGE_EVENT = "zap:environment-change";

/**
 * Platform Environment Policy:
 * All user & admin facing pages strictly connect to the Production Database (zap_platform).
 * The Load Test page alone strictly routes to the Lower QA Database (zap_platform_lower).
 * There are zero environment selection controls in the UI for any user or admin.
 */
export const ENABLE_QA_ENVIRONMENT: boolean = false;

export function getEnvironment(): ZAPEnvironment {
  return "production";
}

export function setEnvironment(_environment: ZAPEnvironment): void {
  // Permanently disabled in UI. All standard pages strictly run against production DB.
}
