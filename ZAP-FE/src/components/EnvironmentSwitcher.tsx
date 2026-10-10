"use client";

import { useState } from "react";
import {
  getEnvironment,
  setEnvironment,
  ENABLE_QA_ENVIRONMENT,
  type ZAPEnvironment,
} from "@/services/environment";

const OPTIONS: ZAPEnvironment[] = ["production", "qa"];

export function EnvironmentSwitcher() {
  if (!ENABLE_QA_ENVIRONMENT) {
    return null;
  }

  const [environment, setCurrentEnvironment] = useState<ZAPEnvironment>(() => getEnvironment());
  const isQa = environment === "qa";

  function selectEnvironment(nextEnvironment: ZAPEnvironment) {
    setEnvironment(nextEnvironment);
    setCurrentEnvironment(nextEnvironment);
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-[#d0d7de] dark:border-[#30363d] bg-white dark:bg-[#161b22] p-0.5 text-xs"
      role="group"
      aria-label="Select environment"
    >
      {OPTIONS.map((option) => {
        const active = option === environment;
        return (
          <button
            key={option}
            type="button"
            onClick={() => selectEnvironment(option)}
            aria-pressed={active}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              active
                ? "bg-[#f3f4f6] dark:bg-[#21262d] text-[#1f2328] dark:text-[#e6edf3] font-semibold"
                : "text-[#656d76] dark:text-[#8b949e] hover:text-[#1f2328] dark:hover:text-[#e6edf3]"
            }`}
          >
            {option === "production" ? "Prod" : "QA"}
          </button>
        );
      })}
      <span
        className={`ml-1 mr-1.5 h-1.5 w-1.5 rounded-full ${isQa ? "bg-amber-500" : "bg-emerald-500"}`}
        aria-label={`${isQa ? "QA" : "Production"} environment active`}
      />
    </div>
  );
}
