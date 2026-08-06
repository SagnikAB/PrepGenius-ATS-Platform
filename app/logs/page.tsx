import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LogsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resumes } = await supabase
    .from("resumes")
    .select("id,original_filename,processing_status,processing_error,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const records = resumes ?? [];
  const processing = records.filter((resume) => resume.processing_status === "processing").length;
  const completed = records.filter((resume) => resume.processing_status === "completed").length;
  const failed = records.filter((resume) => resume.processing_status === "failed").length;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Processing Center</h1>
          <p className="mt-2 text-gray-600">Review resume-processing records in your workspace.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <section className="lg:col-span-3 rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">Processing history</h2>
              <p className="mt-1 text-gray-600">Most recent 50 resume-processing records.</p>
            </div>
            <div className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto">
              {records.length === 0 ? (
                <p className="p-6 text-gray-500">No resume processing records yet.</p>
              ) : records.map((resume) => (
                <article key={resume.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="truncate font-medium text-gray-900">{resume.original_filename}</p>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{resume.processing_status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{new Date(resume.created_at).toLocaleString()}</p>
                  {resume.processing_error && <p className="mt-2 text-sm text-red-600">{resume.processing_error}</p>}
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Queue status</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <p>Processing: <span className="font-semibold text-gray-900">{processing}</span></p>
                <p>Completed: <span className="font-semibold text-gray-900">{completed}</span></p>
                <p>Failed: <span className="font-semibold text-gray-900">{failed}</span></p>
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">About this page</h2>
              <p className="text-sm text-gray-600">Counts and records are read directly from your resume-processing data. Live streaming is not enabled.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
