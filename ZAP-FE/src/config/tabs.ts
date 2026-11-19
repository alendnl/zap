/**
 * Navigation Tabs Configuration
 *
 * All main workbench tabs are configurable here:
 * - dsa: DSA Problems
 * - basic: Basic Concepts
 * - compiler: Compiler Sandbox
 * - contest: Contests & Assessments
 *
 * How to configure:
 * 1. Code change: Simply change `enabled: false` to `true` (or vice-versa) in TAB_CONFIG below.
 * 2. Optional Environment Variable: Alternatively override with NEXT_PUBLIC_ENABLE_TAB_DSA,
 *    NEXT_PUBLIC_ENABLE_TAB_BASIC, NEXT_PUBLIC_ENABLE_TAB_COMPILER, or NEXT_PUBLIC_ENABLE_TAB_CONTEST.
 *
 * Current state:
 * - DSA Problems tab is DISABLED (enabled: false)
 * - Basic Concepts, Compiler, and Contests tabs are ENABLED (enabled: true)
 */

export type NavigationTopic = "dsa" | "basic" | "compiler" | "contest";

export interface TabConfig {
  id: NavigationTopic;
  label: string;
  enabled: boolean;
  description: string;
}

const getEnvOverride = (key: string, defaultValue: boolean): boolean => {
  if (typeof process !== "undefined" && process.env) {
    const val = process.env[key];
    if (val === "true" || val === "1") return true;
    if (val === "false" || val === "0") return false;
  }
  return defaultValue;
};

export const TAB_CONFIG: Record<NavigationTopic, TabConfig> = {
  // DSA Problems tab: currently disabled as requested. Set `enabled: true` to restore anytime.
  dsa: {
    id: "dsa",
    label: "DSA Problems",
    enabled: getEnvOverride("NEXT_PUBLIC_ENABLE_TAB_DSA", false),
    description: "Curated algorithms and data structures arena",
  },
  // Basic Concepts tab: enabled
  basic: {
    id: "basic",
    label: "Basic Concepts",
    enabled: getEnvOverride("NEXT_PUBLIC_ENABLE_TAB_BASIC", true),
    description: "Infosys SE screening concepts and foundational problems",
  },
  // Compiler tab: enabled
  compiler: {
    id: "compiler",
    label: "Compiler",
    enabled: getEnvOverride("NEXT_PUBLIC_ENABLE_TAB_COMPILER", true),
    description: "Multi-language isolated code runner and sandbox",
  },
  // Contests tab: enabled
  contest: {
    id: "contest",
    label: "Contests",
    enabled: getEnvOverride("NEXT_PUBLIC_ENABLE_TAB_CONTEST", true),
    description: "Timed technical assessments and competitions",
  },
};

/**
 * Check if a tab is currently enabled.
 */
export function isTabEnabled(tab: NavigationTopic): boolean {
  return Boolean(TAB_CONFIG[tab]?.enabled);
}

/**
 * List of currently enabled tab keys in display order.
 */
export const ENABLED_TABS: NavigationTopic[] = (
  ["dsa", "basic", "compiler", "contest"] as NavigationTopic[]
).filter((tab) => isTabEnabled(tab));

/**
 * Default fallback tab: first enabled tab.
 * When DSA is disabled, this automatically resolves to the next enabled tab (e.g., "basic").
 */
export const DEFAULT_TAB: NavigationTopic =
  ENABLED_TABS[0] ?? "basic";
