"use client";

import { useTheme, type ThemeMode } from "./theme-provider";

const modes: Array<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "White" },
  { value: "system", label: "System" },
];

export function ThemeSwitcher() {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {modes.map((option) => {
        const active = themeMode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setThemeMode(option.value)}
            className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
              active ? "border-transparent shadow-lg shadow-black/20" : "border-white/10"
            }`}
            style={{
              backgroundColor: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
              color: "var(--text-primary)",
            }}
          >
            {option.label}
          </button>
        );
      })}

      <p className="w-full text-sm" style={{ color: "var(--accent-text)" }}>
        {themeMode === "system" ? `System is currently ${resolvedTheme}` : `Current mode: ${themeMode}`}
      </p>
    </div>
  );
}
