"use client";

import { useState } from "react";
import { MagnetLines } from "@/components/magnet-lines";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    if (!email || !password) {
      setMessage("Enter your email and password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { data, error } = await createClient().auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      data?.user
        ? "Account created. Please check your email to confirm and then sign in."
        : "Check your email for a confirmation link to complete sign up."
    );
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <MagnetLines rows={7} columns={9} baseAngle={-6} className="opacity-70" />

      <div className="glass-panel relative z-10 w-full max-w-md rounded-[1.75rem] p-8" style={{ color: "var(--card-foreground)" }}>
        <div className="hero-pill">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Create your account
        </div>
        <h1 className="mt-4 text-2xl font-bold">Sign up for PrepGenius</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
          Create a new account to access the dashboard and upload resumes.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSignUp}>
          <input type="email" required placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" required minLength={8} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" required minLength={8} placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

          <button disabled={loading} className="accent-btn w-full" type="submit">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm" style={{ color: "var(--card-muted)" }}>{message}</p>}
      </div>
    </main>
  );
}
