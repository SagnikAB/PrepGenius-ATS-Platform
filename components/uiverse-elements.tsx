"use client";
import React from "react";

export function UIverseBadge({ children, variant = "sky" }: { children: React.ReactNode; variant?: "sky" | "pink" | "mint" | "amber" }) {
  const variantStyles = {
    sky: "border-sky-400/30 bg-sky-500/10 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.2)]",
    pink: "border-pink-400/30 bg-pink-500/10 text-pink-200 shadow-[0_0_12px_rgba(244,114,182,0.2)]",
    mint: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.2)]",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.2)]",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-all duration-300 hover:scale-105 ${variantStyles[variant]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {children}
    </span>
  );
}

export function UIverseLoader({ text = "Processing…" }: { text?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative flex h-7 w-7 items-center justify-center">
        <div className="absolute h-full w-full rounded-full border-2 border-sky-400/20 border-t-sky-400 animate-spin" />
        <div className="absolute h-4 w-4 rounded-full border-2 border-pink-400/30 border-b-pink-400 animate-spin [animation-direction:reverse]" />
      </div>
      <span className="text-xs font-medium text-sky-200 animate-pulse">{text}</span>
    </div>
  );
}

export function UIverseAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "C";

  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-sky-400/20 via-pink-400/15 to-emerald-400/20 text-xs font-bold text-white shadow-inner backdrop-blur-md transition-transform duration-300 hover:scale-110">
      {initials}
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
    </div>
  );
}
