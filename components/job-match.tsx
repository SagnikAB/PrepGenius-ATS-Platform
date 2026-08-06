"use client";
import { useState } from "react";

type Match = {
  id: string;
  full_name: string;
  headline: string | null;
  skills: string[];
  total_experience_months: number;
  similarity: number;
  explanation: string;
};

export function JobMatch() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResults([]);
    setStatus("Ranking candidates and preparing evidence-based explanations…");

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const body = await res.text();
      let data: { error?: string; results?: Match[] } = {};
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error(`The matching service returned ${res.status}. Check Vercel Runtime Logs for the server error.`);
      }

      if (!res.ok || data.error) throw new Error(data.error || "Matching request failed.");

      const matches = data.results || [];
      setResults(matches);
      setStatus(matches.length ? "" : "No parsed candidate profiles are available yet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to match candidates. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass-panel rounded-[1.5rem] p-6" style={{ color: "var(--card-foreground)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-label">Match engine</p>
          <h2 className="mt-2 text-xl font-bold">Match a job description</h2>
        </div>
        <div className="status-pill">AI ranked</div>
      </div>

      <p className="mt-3 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
        Paste a role brief and receive ranked candidates with concise evidence for each recommendation.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Role title" />
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Paste a detailed job description (30+ characters)" rows={6} />
        <button disabled={loading} className="accent-btn">
          {loading ? "Matching…" : "Find semantic matches"}
        </button>
      </form>

      {status && (
        <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm" style={{ color: "var(--card-muted)" }}>
          {status}
        </p>
      )}

      {!loading && !status && results.length === 0 && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/10 p-4 text-sm" style={{ color: "var(--card-muted)" }}>
          Add a role title and description to surface ranked talent with transparent evidence.
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          {results.map((r) => (
            <article key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--card-muted)" }}>
                    {r.headline}
                  </p>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
                  {Math.round(r.similarity * 100)}%
                </div>
              </div>
              <div className="mt-3 text-sm leading-6" style={{ color: "var(--card-muted)" }}>
                {r.explanation}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
