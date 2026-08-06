interface DashboardCandidateListProps {
  initialCandidates: Array<{
    id: string;
    full_name: string;
    headline: string | null;
    skills: string[] | null;
    total_experience_months: number;
  }>;
}

export function DashboardCandidateList({ initialCandidates }: DashboardCandidateListProps) {
  return (
    <div>
      {/* Candidate list */}
      <div className="space-y-2">
        {initialCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="rounded-lg border border-white/10 bg-white/5 p-4 flex items-start justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-start gap-3 flex-1">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{candidate.full_name}</p>
                {candidate.headline && (
                  <p className="text-sm" style={{ color: "var(--card-muted)" }}>
                    {candidate.headline}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-1">
                  {candidate.skills && candidate.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="chip text-xs">
                      {skill}
                    </span>
                  ))}
                  {candidate.skills && candidate.skills.length > 3 && (
                    <span className="chip text-xs">+{candidate.skills.length - 3}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="ml-2 text-right">
              <p className="text-sm" style={{ color: "var(--card-muted)" }}>
                {Math.round((candidate.total_experience_months / 12) * 10) / 10} yrs
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
