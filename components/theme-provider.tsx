"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

type ThemeContextType = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (themeMode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(themeMode: ThemeMode, resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = themeMode;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const storedThemeMode = window.localStorage.getItem("theme-mode") as ThemeMode | null;
    const initialThemeMode = storedThemeMode ?? "system";
    const initialResolvedTheme = initialThemeMode === "system" ? getSystemTheme() : initialThemeMode;

    setThemeModeState(initialThemeMode);
    setResolvedTheme(initialResolvedTheme);
    applyTheme(initialThemeMode, initialResolvedTheme);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (themeMode === "system") {
        const nextResolvedTheme = getSystemTheme();
        setResolvedTheme(nextResolvedTheme);
        applyTheme("system", nextResolvedTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode: (nextThemeMode: ThemeMode) => {
        const nextResolvedTheme = nextThemeMode === "system" ? getSystemTheme() : nextThemeMode;

        setThemeModeState(nextThemeMode);
        setResolvedTheme(nextResolvedTheme);
        applyTheme(nextThemeMode, nextResolvedTheme);
        window.localStorage.setItem("theme-mode", nextThemeMode);
      },
    }),
    [resolvedTheme, themeMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
