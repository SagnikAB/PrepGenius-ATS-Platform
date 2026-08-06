"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnetLines } from "@/components/magnet-lines";
import { createClient } from "@/lib/supabase/client";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
  }, [router]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    // Validation
    if (!email || !password || !confirmPassword || !fullName) {
      setMessage("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      // Sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        setMessage("Account created! Check your email to confirm your registration.");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setFullName("");
        
        // Redirect after a short delay
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "An error occurred during signup.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <MagnetLines rows={7} columns={9} baseAngle={-6} className="opacity-70" />

      <div className="glass-panel relative z-10 w-full max-w-md rounded-[1.75rem] p-8" style={{ color: "var(--card-foreground)" }}>
        <div className="hero-pill">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Create account
        </div>
        <h1 className="mt-4 text-2xl font-bold">Join PrepGenius</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
          Create an account to start building a smarter hiring pipeline.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSignup}>
          <input
            type="text"
            required
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />

          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="pr-12"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 text-slate-500 hover:text-slate-900"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              className="pr-12"
            />
            <button
              type="button"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              title={showConfirmPassword ? "Hide password" : "Show password"}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 text-slate-500 hover:text-slate-900"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          <button disabled={loading} className="accent-btn w-full">
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm" style={{ color: message.includes("Check") ? "var(--accent-text)" : "var(--card-muted)" }}>
            {message}
          </p>
        )}

        <p className="mt-4 text-center text-sm" style={{ color: "var(--card-muted)" }}>
          Already have an account?{" "}
          <a href="/login" className="font-semibold hover:underline" style={{ color: "var(--accent-text)" }}>
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
