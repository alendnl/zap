"use client";

import { useState } from "react";
import { getEnvironment, setEnvironment, type ZAPEnvironment } from "@/services/environment";

const OPTIONS: ZAPEnvironment[] = ["production", "qa"];

export function EnvironmentSwitcher() {
  const [environment, setCurrentEnvironment] = useState<ZAPEnvironment>(() => getEnvironment());
  const isQa = environment === "qa";

  function selectEnvironment(nextEnvironment: ZAPEnvironment) {
    setEnvironment(nextEnvironment);
    setCurrentEnvironment(nextEnvironment);
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border p-1 ${
        isQa ? "border-amber-800/60 bg-amber-950/30" : "border-emerald-800/60 bg-emerald-950/30"
      }`}
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
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              active
                ? option === "qa"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-emerald-500/20 text-emerald-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {option === "production" ? "Prod" : "QA"}
          </button>
        );
      })}
      <span
        className={`ml-1 mr-1 h-2 w-2 rounded-full ${isQa ? "bg-amber-400" : "bg-emerald-400"}`}
        aria-label={`${isQa ? "QA" : "Production"} environment active`}
      />
    </div>
  );
}
