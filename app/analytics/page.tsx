import { AnalyticsDashboard, type AnalyticsData } from "@/components/analytics-dashboard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: resumes }, { data: candidates }] = await Promise.all([
    supabase.from("resumes").select("created_at,processing_status"),
    supabase.from("candidates").select("skills"),
  ]);

  const completedByDate = new Map<string, number>();
  for (const resume of resumes ?? []) {
    if (resume.processing_status !== "completed") continue;
    const date = new Date(resume.created_at).toLocaleDateString();
    completedByDate.set(date, (completedByDate.get(date) ?? 0) + 1);
  }

  const skillCounts = new Map<string, number>();
  for (const candidate of candidates ?? []) {
    for (const skill of candidate.skills ?? []) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }

  const analyticsData: AnalyticsData = {
    timeSeriesData: Array.from(completedByDate, ([date, completedResumes]) => ({ date, completedResumes, matches: 0, avgScore: 0 })),
    matchScoreDistribution: ["90-100", "80-89", "70-79", "60-69", "50-59", "0-49"].map((range) => ({ range, count: 0 })),
    qualityMetrics: [],
    skillGapData: Array.from(skillCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([skill, supply]) => ({ skill, supply, demand: 0 })),
    performanceTrend: [],
    candidateSourceData: [],
  };

  return <AnalyticsDashboard data={analyticsData} />;
}
