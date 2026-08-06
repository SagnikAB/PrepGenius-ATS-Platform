import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DotFieldBackground } from "../components/dot-field-background";
import { MagnetLines } from "../components/magnet-lines";
import { ShinyText } from "../components/shiny-text";

const highlights = [
  "Semantic matching",
  "Audit-ready insights",
  "Resume normalization",
];

const workflow = [
  { title: "Capture", detail: "Upload resumes and let the system parse structured candidate context." },
  { title: "Rank", detail: "Compare applicants against a role with evidence-backed similarity scoring." },
  { title: "Decide", detail: "Share concise, explainable summaries with your hiring team." },
];

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <main className="relative isolate overflow-hidden">
      <DotFieldBackground />
      <MagnetLines rows={8} columns={10} baseAngle={-10} className="opacity-90" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-6 py-24 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="glass-panel max-w-3xl rounded-[2rem] p-8 sm:p-12 lg:p-14">
            <div className="hero-pill">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              AI-native hiring OS
            </div>

            <p className="mt-6 section-label">
              <ShinyText text="PrepGenius" color="var(--accent-text)" shineColor="white" speed={2.2} />
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl" style={{ color: "var(--text-primary)" }}>
              <ShinyText
                text="Hire on evidence, not keyword noise."
                color="var(--text-primary)"
                shineColor="white"
                speed={2.8}
                spread={140}
              />
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: "var(--accent-text)" }}>
              Build a calmer pipeline from intake to shortlist with secure resume intake, structured profiles, and explainable AI matching.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="accent-btn">
                Open dashboard
              </Link>
              {isAuthenticated ? (
                <form action="/auth/signout" method="post">
                  <button type="submit" className="secondary-btn">
                    Sign out
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login" className="secondary-btn">
                    Sign in
                  </Link>
                  <Link href="/signup" className="secondary-btn">
                    Sign up
                  </Link>
                </>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {highlights.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
            <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="section-label">Live workspace</p>
                  <h2 className="mt-2 text-xl font-semibold">From intake to shortlist in minutes</h2>
                </div>
                <div className="status-pill">Live</div>
              </div>

              <div className="mt-6 grid gap-3">
                {workflow.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-950/10 p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
                      <p className="font-semibold">{item.title}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
