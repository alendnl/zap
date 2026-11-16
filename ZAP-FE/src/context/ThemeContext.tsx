"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialTheme = (): Theme => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = (localStorage.getItem("zap-theme") ||
        localStorage.getItem("zap_theme") ||
        localStorage.getItem("theme")) as Theme | null;
      if (stored === "light" || stored === "dark") return stored;
      if (document.documentElement.classList.contains("dark")) return "dark";
      if (document.documentElement.classList.contains("light")) return "light";
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    } catch {}
    return "light";
  };

  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());

  const applyTheme = useCallback((t: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.remove("light");
      root.classList.add("dark");
      root.style.colorScheme = "dark";
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
      root.setAttribute("data-theme", "light");
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem("zap-theme", newTheme);
        localStorage.setItem("zap_theme", newTheme);
        localStorage.setItem("theme", newTheme);
        document.cookie = `zap-theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("zap-theme", next);
        localStorage.setItem("zap_theme", next);
        localStorage.setItem("theme", next);
        document.cookie = `zap-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  useEffect(() => {
    const current = getInitialTheme();
    setThemeState(current);
    applyTheme(current);

    const handleStorage = (e: StorageEvent) => {
      if (
        (e.key === "zap-theme" || e.key === "zap_theme" || e.key === "theme") &&
        (e.newValue === "light" || e.newValue === "dark")
      ) {
        setThemeState(e.newValue);
        applyTheme(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
