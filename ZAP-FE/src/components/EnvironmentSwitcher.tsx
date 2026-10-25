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
      className="inline-flex items-center gap-0.5 rounded-lg border border-[#e2e8f0] dark:border-[#232f45] bg-[#f8fafc] dark:bg-[#1a2233] p-0.5 text-xs"
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
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer ${
              active
                ? "bg-white dark:bg-[#121824] text-[#0f172a] dark:text-white shadow-xs border border-[#e2e8f0] dark:border-[#232f45]"
                : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
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
