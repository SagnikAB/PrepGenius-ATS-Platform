"use client";

import { useState } from "react";
import type { SkillGapAnalysis } from "@/lib/skill-gap-analyzer";

export type CandidateForComparison = {
  id: string;
  full_name: string;
  headline?: string;
  skills: string[];
  total_experience_months: number;
  overallScore: number;
  scoreBreakdown: {
    skills: number;
    experience: number;
    projects: number;
    education: number;
    keywords: number;
    semantic: number;
    formatting: number;
  };
  skillGapAnalysis?: SkillGapAnalysis;
  strengths: string[];
  weaknesses: string[];
  explanation: string;
};

interface CandidateComparisonProps {
  candidates: CandidateForComparison[];
  onRemove?: (candidateId: string) => void;
}

export function CandidateComparison({ candidates, onRemove }: CandidateComparisonProps) {
  const [selectedMetric, setSelectedMetric] = useState<"overall" | "skills" | "experience" | "semantic">("overall");

  if (candidates.length === 0) {
    return (
      <div className="glass-panel rounded-[1.5rem] border border-white/10 p-8 text-center">
        <p style={{ color: "var(--card-muted)" }}>Select candidates to compare side by side.</p>
      </div>
    );
  }

  const sortedByScore = [...candidates].sort((a, b) => b.overallScore - a.overallScore);

  return (
    <div className="space-y-6">
      {/* Metric selector */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
        <button
          onClick={() => setSelectedMetric("overall")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            selectedMetric === "overall" ? "bg-indigo-500/30 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          Overall
        </button>
        <button
          onClick={() => setSelectedMetric("skills")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            selectedMetric === "skills" ? "bg-indigo-500/30 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          Skills
        </button>
        <button
          onClick={() => setSelectedMetric("experience")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            selectedMetric === "experience" ? "bg-indigo-500/30 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          Experience
        </button>
        <button
          onClick={() => setSelectedMetric("semantic")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            selectedMetric === "semantic" ? "bg-indigo-500/30 text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          Semantic Match
        </button>
      </div>

      {/* Comparison cards */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {sortedByScore.map((candidate, idx) => {
          const scoreDisplay =
            selectedMetric === "overall"
              ? candidate.overallScore
              : candidate.scoreBreakdown[selectedMetric as keyof typeof candidate.scoreBreakdown];

          const scoreColor =
            scoreDisplay >= 80 ? "text-emerald-400" : scoreDisplay >= 60 ? "text-yellow-400" : "text-red-400";

          return (
            <div
              key={candidate.id}
              className="glass-panel relative rounded-[1.25rem] border border-white/10 p-6"
            >
              {/* Ranking badge */}
              <div className="absolute -top-3 left-4 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white">
                #{idx + 1}
              </div>

              {/* Remove button */}
              {onRemove && (
                <button
                  onClick={() => onRemove(candidate.id)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition"
                  title="Remove from comparison"
                >
                  ✕
                </button>
              )}

              {/* Name and headline */}
              <div className="mt-2">
                <h3 className="text-lg font-bold">{candidate.full_name}</h3>
                {candidate.headline && (
                  <p className="mt-1 text-sm" style={{ color: "var(--card-muted)" }}>
                    {candidate.headline}
                  </p>
                )}
              </div>

              {/* Score */}
              <div className="mt-4 space-y-1">
                <p className="text-xs font-semibold uppercase" style={{ color: "var(--card-muted)" }}>
                  {selectedMetric} Score
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${scoreColor}`}>{scoreDisplay}</span>
                  <span className="text-xl" style={{ color: "var(--card-muted)" }}>/100</span>
                </div>

                {/* Score bar */}
                <div className="mt-2 h-2 w-full rounded-full border border-white/10 overflow-hidden bg-white/5">
                  <div
                    className={`h-full transition-all ${
                      scoreDisplay >= 80 ? "bg-emerald-500" : scoreDisplay >= 60 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(scoreDisplay, 100)}%` }}
                  />
                </div>
              </div>

              {/* Experience */}
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold">Experience</p>
                <p className="text-sm">{Math.round((candidate.total_experience_months / 12) * 10) / 10} years</p>
              </div>

              {/* Skills */}
              {candidate.skills && candidate.skills.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">Top Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills.slice(0, 4).map((skill) => (
                      <span key={skill} className="chip text-xs">
                        {skill}
                      </span>
                    ))}
                    {candidate.skills.length > 4 && (
                      <span className="chip text-xs">+{candidate.skills.length - 4}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Skill Gap Summary */}
              {candidate.skillGapAnalysis && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold">Skill Readiness</p>
                  <p className="text-xs" style={{ color: "var(--card-muted)" }}>
                    {candidate.skillGapAnalysis.skillGapSummary}
                  </p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Readiness</span>
                      <span className="font-semibold">{candidate.skillGapAnalysis.readinessPercentage}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full border border-white/10 overflow-hidden bg-white/5">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${candidate.skillGapAnalysis.readinessPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths and weaknesses */}
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                {candidate.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Strengths</p>
                    <ul className="mt-1 space-y-1">
                      {candidate.strengths.slice(0, 2).map((strength, i) => (
                        <li key={i} className="text-xs flex gap-2">
                          <span>✓</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {candidate.weaknesses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400">Areas to Develop</p>
                    <ul className="mt-1 space-y-1">
                      {candidate.weaknesses.slice(0, 2).map((weakness, i) => (
                        <li key={i} className="text-xs flex gap-2">
                          <span>⚠</span>
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recommended learnings */}
              {candidate.skillGapAnalysis && candidate.skillGapAnalysis.recommendedLearnings.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold">Recommended Learning</p>
                  <div className="space-y-2">
                    {candidate.skillGapAnalysis.recommendedLearnings.slice(0, 2).map((learning, i) => (
                      <div key={i} className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{learning.skill}</span>
                          <span className="text-indigo-400">P{learning.priority}</span>
                        </div>
                        <p className="mt-1" style={{ color: "var(--card-muted)" }}>
                          {learning.estimatedTime}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="mt-4 text-xs p-3 rounded-lg border border-white/10 bg-white/5">
                <p style={{ color: "var(--card-muted)" }}>{candidate.explanation}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
