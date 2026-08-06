"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeSwitcher } from "./theme-switcher";
import { createClient } from "@/lib/supabase/client";

const baseLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    const syncAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (active) setIsAuthenticated(Boolean(session));
    };

    syncAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setIsAuthenticated(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/35 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/10 text-lg font-semibold text-indigo-300">
              P
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-300">PrepGenius</p>
              <p className="text-xs text-slate-400">Recruiting intelligence</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {baseLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? "bg-white/10 text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {isAuthenticated ? (
              <form action="/auth/signout" method="post">
                <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/10">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white">
                Sign in
              </Link>
            )}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <div className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-300">
              AI-native
            </div>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
