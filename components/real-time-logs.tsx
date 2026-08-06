'use client';

import React, { useState, useEffect, useRef } from 'react';

export interface ProcessingLog {
  id: string;
  timestamp: Date;
  message: string;
  status: 'info' | 'success' | 'warning' | 'error';
  resumeId?: string;
  resumeName?: string;
  progress?: number;
  details?: string;
}

export interface ProcessingQueue {
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  logs: ProcessingLog[];
  isLive: boolean;
}

/**
 * Real-time Processing Logs Component
 * Displays live updates of resume processing
 */
export function RealTimeProcessingLogs() {
  const [queue, setQueue] = useState<ProcessingQueue>({
    totalProcessing: 0,
    totalCompleted: 0,
    totalFailed: 0,
    logs: [],
    isLive: true,
  });

  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Simulate receiving logs (in production, this would be via WebSocket or Server-Sent Events)
  useEffect(() => {
    if (!queue.isLive) return;

    const interval = setInterval(() => {
      const statuses: Array<'info' | 'success' | 'warning' | 'error'> = [
        'info',
        'success',
        'warning',
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const resumeNames = ['Sarah_Resume.pdf', 'john_doe.docx', 'resume_2024.pdf'];
      const resumeName = resumeNames[Math.floor(Math.random() * resumeNames.length)];

      const newLog: ProcessingLog = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date(),
        message: `Processing ${resumeName}...`,
        status,
        resumeId: `resume_${Math.random().toString(36).substr(2, 5)}`,
        resumeName,
        progress: Math.floor(Math.random() * 100) + 1,
        details:
          status === 'success'
            ? 'Resume parsed successfully'
            : status === 'error'
              ? 'Failed to extract text from PDF'
              : 'Processing in progress',
      };

      setQueue((prev) => {
        const newLogs = [newLog, ...prev.logs].slice(0, 100);
        let totalProcessing = prev.totalProcessing;
        let totalCompleted = prev.totalCompleted;
        let totalFailed = prev.totalFailed;

        if (status === 'success') totalCompleted++;
        if (status === 'error') totalFailed++;

        return {
          ...prev,
          logs: newLogs,
          totalProcessing,
          totalCompleted,
          totalFailed,
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [queue.isLive]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [queue.logs, autoScroll]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 70) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="w-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Processing Logs</h2>
            <p className="text-gray-600 mt-1">Real-time resume processing updates</p>
          </div>
          <div
            className={`h-3 w-3 rounded-full ${
              queue.isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
            }`}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {queue.totalProcessing}
            </div>
            <p className="text-gray-600 text-sm">Processing</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {queue.totalCompleted}
            </div>
            <p className="text-gray-600 text-sm">Completed</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {queue.totalFailed}
            </div>
            <p className="text-gray-600 text-sm">Failed</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setQueue({ ...queue, isLive: !queue.isLive })}
            className={`px-3 py-1 rounded text-sm font-medium ${
              queue.isLive
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {queue.isLive ? '🔴 Live' : '⚫ Paused'}
          </button>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              autoScroll
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {autoScroll ? '📌 Auto-scroll' : '📍 Manual'}
          </button>
          <button
            onClick={() =>
              setQueue({ ...queue, logs: [], totalCompleted: 0, totalFailed: 0 })
            }
            className="px-3 py-1 rounded text-sm font-medium bg-gray-100 text-gray-800"
          >
            Clear Logs
          </button>
        </div>
      </div>

      {/* Logs Container */}
      <div className="h-96 overflow-y-auto bg-gray-50">
        {queue.logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No logs yet. Waiting for processing events...</p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {queue.logs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded border-l-4 cursor-pointer transition-all ${getStatusColor(
                  log.status
                )} ${
                  expandedLogId === log.id
                    ? 'border-l-4 bg-white shadow'
                    : 'border-l-4 hover:shadow'
                }`}
                onClick={() =>
                  setExpandedLogId(expandedLogId === log.id ? null : log.id)
                }
              >
                {/* Log Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-bold text-lg">
                      {getStatusIcon(log.status)}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{log.message}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {log.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  {log.progress !== undefined && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-300 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getProgressColor(log.progress)} transition-all`}
                          style={{ width: `${log.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 w-8">
                        {log.progress}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {expandedLogId === log.id && (
                  <div className="mt-3 pt-3 border-t border-current border-opacity-20 space-y-2">
                    {log.resumeName && (
                      <div className="text-sm">
                        <span className="font-medium">Resume:</span>{' '}
                        <span className="text-gray-700">{log.resumeName}</span>
                      </div>
                    )}
                    {log.resumeId && (
                      <div className="text-sm">
                        <span className="font-medium">ID:</span>{' '}
                        <code className="bg-white bg-opacity-50 px-1 rounded text-xs">
                          {log.resumeId}
                        </code>
                      </div>
                    )}
                    {log.details && (
                      <div className="text-sm">
                        <span className="font-medium">Details:</span>
                        <p className="text-gray-700 mt-1">{log.details}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 bg-gray-50 text-xs text-gray-600">
        <p>
          Showing {queue.logs.length} of {queue.logs.length} logs • Last update:{' '}
          {queue.logs[0]?.timestamp.toLocaleTimeString() || 'N/A'}
        </p>
      </div>
    </div>
  );
}

/**
 * Processing Stats Card
 * Displays quick stats about processing queue
 */
export function ProcessingStatsCard({
  stats,
}: {
  stats: Pick<ProcessingQueue, 'totalProcessing' | 'totalCompleted' | 'totalFailed'>;
}) {
  const total = stats.totalProcessing + stats.totalCompleted + stats.totalFailed;
  const successRate = total > 0 ? ((stats.totalCompleted / total) * 100).toFixed(1) : '0';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Processing</span>
          <span className="font-semibold text-blue-600">{stats.totalProcessing}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Completed</span>
          <span className="font-semibold text-green-600">{stats.totalCompleted}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Failed</span>
          <span className="font-semibold text-red-600">{stats.totalFailed}</span>
        </div>
        <div className="border-t pt-3 flex items-center justify-between">
          <span className="text-gray-600">Success Rate</span>
          <span className="font-semibold text-gray-900">{successRate}%</span>
        </div>
      </div>
    </div>
  );
}
