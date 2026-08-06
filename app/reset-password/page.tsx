"use client";

import { useState } from "react";
import { MagnetLines } from "@/components/magnet-lines";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return setMessage("Passwords do not match.");
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setMessage(error?.message || "Password updated. You can now sign in.");
    setLoading(false);
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <MagnetLines rows={6} columns={8} baseAngle={-6} className="opacity-70" />

      <div className="glass-panel relative z-10 w-full max-w-md rounded-[1.75rem] p-8" style={{ color: "var(--card-foreground)" }}>
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-sm font-semibold text-indigo-300">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Password reset
        </div>
        <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <input type="password" required minLength={8} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" required minLength={8} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button disabled={loading} className="w-full bg-indigo-600 text-white">{loading ? "Updating…" : "Update password"}</button>
        </form>

        {message && <p className="mt-4 text-sm" style={{ color: "var(--card-muted)" }}>{message}</p>}
      </div>
    </main>
  );
}
