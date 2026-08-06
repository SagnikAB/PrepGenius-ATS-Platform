import { createClient } from "@/lib/supabase/server";
import { UploadResume } from "@/components/upload-resume";
import { JobMatch } from "@/components/job-match";
import { MagnetLines } from "@/components/magnet-lines";
import { DashboardCandidateList } from "@/components/dashboard-candidate-list";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function clearCandidateLibrary() {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: candidates } = await supabase.from("candidates").select("id").eq("user_id", user.id);
  const candidateIds = candidates?.map((candidate) => candidate.id) ?? [];

  if (candidateIds.length > 0) {
    const { data: resumes } = await supabase.from("resumes").select("storage_path").in("candidate_id", candidateIds);
    const storagePaths = resumes?.map((resume) => resume.storage_path).filter(Boolean) ?? [];

    if (storagePaths.length > 0) {
      await supabase.storage.from("resumes").remove(storagePaths);
    }

    await supabase.from("resumes").delete().in("candidate_id", candidateIds);
    await supabase.from("candidates").delete().in("id", candidateIds);
  }

  revalidatePath("/dashboard");
}

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id,full_name,headline,skills,total_experience_months,created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-6 py-10">
      <MagnetLines rows={7} columns={10} baseAngle={-10} className="opacity-80" />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <div className="glass-panel rounded-[2rem] p-6 sm:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-label">PrepGenius ATS</p>
              <h1 className="text-3xl font-bold">Talent intelligence dashboard</h1>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
                Track structured profiles, rank applicants, and keep hiring conversations transparent.
              </p>
            </div>
            <form action="/auth/signout" method="post">
              <button className="accent-btn">Sign out</button>
            </form>
          </header>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { label: "Structured profiles", value: "10+ ready" },
              { label: "Semantic matches", value: "Instantly ranked" },
              { label: "Decision support", value: "Audit-ready" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm" style={{ color: "var(--card-muted)" }}>
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <UploadResume />

            <section className="glass-panel rounded-[1.5rem] p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-label">Candidate library</p>
                  <h2 className="mt-2 text-xl font-bold">Latest processed profiles</h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--card-muted)" }}>
                    Check candidates to compare side-by-side
                  </p>
                </div>
                <form action={clearCandidateLibrary}>
                  <button type="submit" className="secondary-btn px-3 py-2 text-sm" disabled={!candidates?.length}>
                    Clear library
                  </button>
                </form>
              </div>

              <div className="mt-4">
                {candidates?.length ? (
                  <DashboardCandidateList initialCandidates={candidates as any} />
                ) : (
                  <p className="text-sm" style={{ color: "var(--card-muted)" }}>
                    No resumes processed yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          <JobMatch />
        </div>
      </div>
    </main>
  );
}
