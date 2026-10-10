"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 select-none
        ${
          theme === "dark"
            ? "bg-slate-900 border-slate-700/80 text-amber-300 hover:bg-slate-800 hover:border-slate-600 shadow-sm"
            : "bg-white border-slate-200 text-sky-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm"
        } ${className}`}
    >
      {theme === "dark" ? (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-400 animate-in fade-in zoom-in" />
          <span className="text-[11px] font-medium text-slate-300">Light</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-sky-600 animate-in fade-in zoom-in" />
          <span className="text-[11px] font-medium text-slate-700">Dark</span>
        </>
      )}
    </button>
  );
};
