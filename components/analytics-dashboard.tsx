'use client';

import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts';

export interface AnalyticsData {
  timeSeriesData: Array<{ date: string; matches: number; avgScore: number; completedResumes: number }>;
  matchScoreDistribution: Array<{ range: string; count: number }>;
  qualityMetrics: Array<{ metric: string; value: number }>;
  skillGapData: Array<{ skill: string; demand: number; supply: number }>;
  performanceTrend: Array<{ week: string; precision: number; recall: number; f1: number }>;
  candidateSourceData: Array<{ source: string; count: number; avgScore: number }>;
}

export const QUALITY_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'];
export const METRIC_COLORS = ['#3b82f6', '#ef4444', '#10b981'];

/**
 * Match Score Distribution Chart
 * Shows histogram of match scores
 */
export function MatchScoreDistributionChart({
  data,
}: {
  data: AnalyticsData['matchScoreDistribution'];
}) {
  return (
    <div className="w-full h-96 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Match Score Distribution</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="range" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Match Quality Pie Chart
 * Displays breakdown of excellent/good/average/poor matches
 */
export function MatchQualityChart({
  data,
}: {
  data: Array<{ name: string; value: number }>;
}) {
  return (
    <div className="w-full h-96 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Match Quality Breakdown</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value, percent }) =>
              `${name}: ${value} (${(percent ? percent * 100 : 0).toFixed(0)}%)`
            }
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={QUALITY_COLORS[index % QUALITY_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Time Series Chart
 * Shows matches and average scores over time
 */
export function TimeSeriesChart({ data }: { data: AnalyticsData['timeSeriesData'] }) {
  return (
    <div className="w-full h-96 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Matching Activity Over Time</h3>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="matches" fill="#3b82f6" name="Matches" />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgScore"
            stroke="#ef4444"
            name="Avg Score"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Performance Metrics Trend Chart
 * Shows precision, recall, and F1-score over time
 */
export function PerformanceMetricsChart({
  data,
}: {
  data: AnalyticsData['performanceTrend'];
}) {
  return (
    <div className="w-full h-96 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Performance Metrics Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" />
          <YAxis domain={[0, 1]} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="precision"
            stroke="#3b82f6"
            name="Precision"
          />
          <Line type="monotone" dataKey="recall" stroke="#ef4444" name="Recall" />
          <Line type="monotone" dataKey="f1" stroke="#10b981" name="F1-Score" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Skill Gap Analysis Chart
 * Shows supply vs demand for skills
 */
export function SkillGapChart({ data }: { data: AnalyticsData['skillGapData'] }) {
  return (
    <div className="w-full h-96 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Skill Gap Analysis</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="skill" angle={-45} textAnchor="end" height={100} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="demand" fill="#ef4444" name="Demand" />
          <Bar dataKey="supply" fill="#10b981" name="Supply" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Key Metrics Summary
 * Displays high-level statistics
 */
export interface KeyMetricsData {
  totalMatches: number;
  avgMatchScore: number;
  precision: number;
  recall: number;
  f1Score: number;
  excellentMatches: number;
  successRate: number;
}

export function KeyMetricsSummary({ data }: { data: KeyMetricsData }) {
  const metrics = [
    {
      label: 'Total Matches',
      value: data.totalMatches.toLocaleString(),
      icon: '📊',
    },
    { label: 'Avg Score', value: `${data.avgMatchScore.toFixed(1)}%`, icon: '⭐' },
    { label: 'Precision', value: `${(data.precision * 100).toFixed(1)}%`, icon: '🎯' },
    { label: 'Recall', value: `${(data.recall * 100).toFixed(1)}%`, icon: '🔍' },
    { label: 'F1-Score', value: `${(data.f1Score * 100).toFixed(1)}%`, icon: '📈' },
    {
      label: 'Excellent',
      value: `${data.excellentMatches}`,
      icon: '🌟',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((metric, idx) => (
        <div key={idx} className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">{metric.label}</p>
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
            </div>
            <div className="text-3xl">{metric.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Complete Analytics Dashboard
 */
export function AnalyticsDashboard({ data }: { data: AnalyticsData }) {
  const qualityData = [
    { name: 'Excellent (90+)', value: 0 },
    { name: 'Good (75-89)', value: 0 },
    { name: 'Average (60-74)', value: 0 },
    { name: 'Poor (40-59)', value: 0 },
    { name: 'Very Poor (<40)', value: 0 },
  ];

  // Extract quality counts from distribution data
  data.matchScoreDistribution.forEach((item) => {
    const range = item.range.split('-');
    const start = parseInt(range[0]);
    const count = item.count;

    if (start >= 90) qualityData[0].value += count;
    else if (start >= 75) qualityData[1].value += count;
    else if (start >= 60) qualityData[2].value += count;
    else if (start >= 40) qualityData[3].value += count;
    else qualityData[4].value += count;
  });

  const keyMetrics: KeyMetricsData = {
    totalMatches: data.timeSeriesData.reduce((sum, d) => sum + d.matches, 0),
    avgMatchScore:
      data.matchScoreDistribution.reduce(
        (sum, item) => sum + parseFloat(item.range.split('-')[0]) * item.count,
        0
      ) / data.matchScoreDistribution.reduce((sum, item) => sum + item.count, 0) || 0,
    precision: data.performanceTrend[data.performanceTrend.length - 1]?.precision || 0,
    recall: data.performanceTrend[data.performanceTrend.length - 1]?.recall || 0,
    f1Score: data.performanceTrend[data.performanceTrend.length - 1]?.f1 || 0,
    excellentMatches: qualityData[0].value,
    successRate: 0.85,
  };

  return (
    <div className="space-y-6 bg-gray-50 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-2">Real-time matching performance metrics</p>
      </div>

      <KeyMetricsSummary data={keyMetrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MatchScoreDistributionChart data={data.matchScoreDistribution} />
        <MatchQualityChart data={qualityData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimeSeriesChart data={data.timeSeriesData} />
        <PerformanceMetricsChart data={data.performanceTrend} />
      </div>

      <SkillGapChart data={data.skillGapData} />

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
        <ul className="space-y-2 text-gray-700">
          <li>• Consider refining skill matching algorithm for improved precision</li>
          <li>• Monitor F1-Score to ensure balance between precision and recall</li>
          <li>• Investigate low-scoring matches to identify potential parsing issues</li>
          <li>• Use skill gap data to highlight candidate development opportunities</li>
        </ul>
      </div>
    </div>
  );
}
