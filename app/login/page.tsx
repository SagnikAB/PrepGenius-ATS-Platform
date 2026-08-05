"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnetLines } from "@/components/magnet-lines";
import { createClient } from "@/lib/supabase/client";

type Mode = "magic" | "password";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (session) router.replace("/dashboard");
    };

    checkSession();

    const error = new URLSearchParams(location.search).get("error");
    if (error)
      setMessage(
        error === "expired_link"
          ? "That sign-in link has expired or was already used. Request a new one."
          : "Sign-in could not be completed. Request a new magic link."
      );
  }, [router]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    setMessage(error?.message || "Check your email for the secure sign-in link.");
    setLoading(false);
  }

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else location.assign("/dashboard");
    setLoading(false);
  }

  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/reset-password` });
    setMessage(error?.message || "If an account exists for that email, a password-reset link has been sent.");
    setLoading(false);
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <MagnetLines rows={7} columns={9} baseAngle={-6} className="opacity-70" />

      <div className="glass-panel relative z-10 w-full max-w-md rounded-[1.75rem] p-8" style={{ color: "var(--card-foreground)" }}>
        <div className="hero-pill">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Secure access
        </div>
        <h1 className="mt-4 text-2xl font-bold">Sign in to PrepGenius</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
          Use a magic link for frictionless sign-in or your password for a familiar workflow.
        </p>

        {showReset ? (
          <form className="mt-6 space-y-4" onSubmit={sendPasswordReset}>
            <p className="text-sm" style={{ color: "var(--card-muted)" }}>
              Enter your account email and we’ll send a password-reset link.
            </p>
            <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button disabled={loading} className="accent-btn w-full">
              {loading ? "Please wait…" : "Send reset link"}
            </button>
            <button type="button" className="secondary-btn w-full" onClick={() => { setShowReset(false); setMessage(""); }}>
              Back to sign in
            </button>
          </form>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/5 p-1">
              <button type="button" onClick={() => { setMode("password"); setMessage(""); }} className={`rounded-xl px-3 py-2 text-sm ${mode === "password" ? "bg-white/10 shadow" : "text-slate-300"}`}>
                Password
              </button>
              <button type="button" onClick={() => { setMode("magic"); setMessage(""); }} className={`rounded-xl px-3 py-2 text-sm ${mode === "magic" ? "bg-white/10 shadow" : "text-slate-300"}`}>
                Magic link
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={mode === "magic" ? sendMagicLink : signInWithPassword}>
              <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />

              {mode === "password" && (
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
                  <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 text-slate-500 hover:text-slate-900">
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <button className="accent-btn w-full" type="submit">{mode === "magic" ? "Send sign-in link" : "Sign in"}</button>
                <button type="button" className="secondary-btn" onClick={() => { setShowReset(true); setMessage(""); }}>
                  Reset
                </button>
              </div>
            </form>
            <div className="mt-4 text-center">
              <a href="/signup" className="text-sm font-medium text-white/80 transition hover:text-white">
                New here? Create an account
              </a>
            </div>
          </>
        )}

        {message && <p className="mt-4 text-sm" style={{ color: "var(--card-muted)" }}>{message}</p>}
      </div>
    </main>
  );
}
