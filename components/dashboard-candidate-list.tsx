import { UIverseAvatar, UIverseBadge } from "@/components/uiverse-elements";

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
      <div className="space-y-3">
        {initialCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="uiverse-card p-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <UIverseAvatar name={candidate.full_name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{candidate.full_name}</p>
                </div>
                {candidate.headline && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--card-muted)" }}>
                    {candidate.headline}
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {candidate.skills && candidate.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="uiverse-chip">
                      {skill}
                    </span>
                  ))}
                  {candidate.skills && candidate.skills.length > 4 && (
                    <span className="uiverse-chip">+{candidate.skills.length - 4}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <UIverseBadge variant="mint">
                {Math.round((candidate.total_experience_months / 12) * 10) / 10} yrs
              </UIverseBadge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

