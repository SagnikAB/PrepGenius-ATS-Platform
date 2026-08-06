'use client';

import { RealTimeProcessingLogs, ProcessingStatsCard } from '@/components/real-time-logs';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LogsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = '/login';
      }
    });
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Processing Center</h1>
          <p className="text-gray-600 mt-2">Monitor resume processing in real-time</p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Real-time Logs */}
          <div className="lg:col-span-3">
            <RealTimeProcessingLogs />
          </div>

          {/* Sidebar Stats */}
          <div className="space-y-6">
            <ProcessingStatsCard
              stats={{
                totalProcessing: 3,
                totalCompleted: 127,
                totalFailed: 5,
              }}
            />

            {/* Quick Info Panel */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Info</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div>
                  <p className="font-medium text-gray-900">Batch Size</p>
                  <p>5 resumes / batch</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Avg Processing</p>
                  <p>12.5 seconds/resume</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Success Rate</p>
                  <p className="text-green-600 font-medium">96.2%</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Uptime</p>
                  <p className="text-green-600 font-medium">99.8%</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium">127</span> resumes processed today
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">5</span> pending uploads
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">0</span> errors in last hour
                </p>
                <button className="mt-4 w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition">
                  View History
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Pro Tip</h3>
          <p className="text-blue-800">
            Real-time processing logs update automatically. Pause to review logs, or enable auto-scroll to
            follow live updates. Click on any log entry to view detailed processing information.
          </p>
        </div>
      </div>
    </div>
  );
}
