"use client";

/**
 * Environment switcher is permanently disabled.
 * All normal platform pages strictly run on Production DB.
 * Load test page alone routes to Lower DB via its dedicated API services.
 */
export function EnvironmentSwitcher() {
  return null;
}
