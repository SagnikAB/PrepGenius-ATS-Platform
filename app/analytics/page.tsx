import { AnalyticsDashboard, type AnalyticsData } from '@/components/analytics-dashboard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// Generate mock analytics data (in production, this would come from database)
function generateMockAnalyticsData(): AnalyticsData {
  const timeSeriesData = Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    matches: Math.floor(Math.random() * 50 + 30),
    avgScore: Math.random() * 30 + 65,
    completedResumes: Math.floor(Math.random() * 20 + 10),
  }));

  const matchScoreDistribution = [
    { range: '90-100', count: Math.floor(Math.random() * 30 + 10) },
    { range: '80-89', count: Math.floor(Math.random() * 40 + 15) },
    { range: '70-79', count: Math.floor(Math.random() * 50 + 20) },
    { range: '60-69', count: Math.floor(Math.random() * 60 + 25) },
    { range: '50-59', count: Math.floor(Math.random() * 40 + 15) },
    { range: '0-49', count: Math.floor(Math.random() * 20 + 5) },
  ];

  const skillGapData = [
    { skill: 'JavaScript', demand: 95, supply: 78 },
    { skill: 'TypeScript', demand: 85, supply: 62 },
    { skill: 'React', demand: 88, supply: 71 },
    { skill: 'Node.js', demand: 82, supply: 65 },
    { skill: 'Python', demand: 90, supply: 85 },
    { skill: 'AWS', demand: 78, supply: 45 },
    { skill: 'Docker', demand: 72, supply: 52 },
    { skill: 'SQL', demand: 89, supply: 81 },
  ];

  const performanceTrend = Array.from({ length: 12 }, (_, i) => ({
    week: `Week ${i + 1}`,
    precision: Math.random() * 0.2 + 0.75,
    recall: Math.random() * 0.2 + 0.7,
    f1: Math.random() * 0.2 + 0.72,
  }));

  return {
    timeSeriesData,
    matchScoreDistribution,
    qualityMetrics: [],
    skillGapData,
    performanceTrend,
    candidateSourceData: [],
  };
}

export default async function AnalyticsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const analyticsData = generateMockAnalyticsData();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <AnalyticsDashboard data={analyticsData} />
      </div>
    </div>
  );
}
