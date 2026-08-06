"use client";

import { useState } from "react";
import { CandidateComparison, type CandidateForComparison } from "@/components/candidate-comparison";

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
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Mock candidate comparison data - in production this would come from the API
  const comparisonCandidates: CandidateForComparison[] = initialCandidates
    .filter((c) => selectedCandidates.has(c.id))
    .map((c, idx) => ({
      ...c,
      headline: c.headline ?? undefined,
      skills: c.skills ?? [],
      overallScore: 75 + Math.random() * 25,
      scoreBreakdown: {
        skills: 80 + Math.random() * 20,
        experience: 70 + Math.random() * 30,
        projects: 60 + Math.random() * 40,
        education: 75 + Math.random() * 25,
        keywords: 65 + Math.random() * 35,
        semantic: 78 + Math.random() * 22,
        formatting: 90 + Math.random() * 10,
      },
      strengths: ["Strong technical skills", "Good communication", "Relevant experience"],
      weaknesses: ["Limited management experience", "New to this domain"],
      explanation: "Good overall fit with relevant background.",
    }));

  function toggleCandidate(id: string) {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedCandidates(newSelected);
  }

  function removeFromComparison(id: string) {
    const newSelected = new Set(selectedCandidates);
    newSelected.delete(id);
    setSelectedCandidates(newSelected);
  }

  return (
    <div className="space-y-4">
      {/* Candidate list */}
      <div className="space-y-2">
        {initialCandidates.map((candidate) => (
          <div
            key={candidate.id}
            className="rounded-lg border border-white/10 bg-white/5 p-4 flex items-start justify-between hover:bg-white/10 transition"
          >
            <div className="flex items-start gap-3 flex-1">
              <input
                type="checkbox"
                checked={selectedCandidates.has(candidate.id)}
                onChange={() => toggleCandidate(candidate.id)}
                className="mt-1"
              />
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

      {/* Comparison view */}
      {selectedCandidates.size > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">
              Comparing {selectedCandidates.size} candidate{selectedCandidates.size === 1 ? "" : "s"}
            </h3>
            <p className="text-sm" style={{ color: "var(--card-muted)" }}>
              Side-by-side view to evaluate and compare profiles
            </p>
          </div>
          <CandidateComparison
            candidates={comparisonCandidates}
            onRemove={removeFromComparison}
          />
        </div>
      )}
    </div>
  );
}
