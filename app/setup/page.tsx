import { MagnetLines } from "@/components/magnet-lines";

export default function SetupPage() {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <MagnetLines rows={6} columns={8} baseAngle={-8} className="opacity-70" />

      <div className="glass-panel relative z-10 w-full max-w-xl rounded-[1.75rem] p-8" style={{ color: "var(--card-foreground)" }}>
        <div className="hero-pill">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Setup required
        </div>
        <h1 className="mt-4 text-2xl font-bold">Configure Supabase in Vercel</h1>
        <p className="mt-4 leading-7" style={{ color: "var(--card-muted)" }}>
          This deployment is missing <code>NEXT_PUBLIC_SUPABASE_URL</code> or <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Add both in Vercel Project Settings → Environment Variables, select the appropriate environment, and redeploy.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
          <p className="font-semibold text-white">Next steps</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Open your Vercel project settings and add the missing environment variables.</li>
            <li>Redeploy the app so auth and resume processing can initialize correctly.</li>
            <li>Return to the dashboard once the project is live.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
