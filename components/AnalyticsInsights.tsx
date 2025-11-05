'use client';

import { AnalyticsData } from '@/types';
import { TrendingUp, TrendingDown, Minus, Activity, Users, Clock, Target } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface AnalyticsInsightsProps {
  data: AnalyticsData;
  conversationalAnswer?: string;
}

export default function AnalyticsInsights({ data, conversationalAnswer }: AnalyticsInsightsProps) {
  const { velocities, teamMetrics, velocityTrends, cycleTime } = data;

  // Prepare velocity chart data
  const velocityChartData = velocities.map(v => ({
    name: v.iteration,
    completed: v.storyPointsCompleted,
    planned: v.storyPointsPlanned,
    completionRate: v.completionRate,
  }));

  // Prepare team distribution chart data
  const teamChartData = Object.entries(teamMetrics.storyPointsByMember)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, points]) => ({
      name: name.split(' ')[0] || name, // First name only
      points,
    }));

  // Get trend icon and color
  const getTrendIcon = () => {
    switch (velocityTrends.trend) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'volatile':
        return <Activity className="w-5 h-5 text-yellow-500" />;
      default:
        return <Minus className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTrendColor = () => {
    switch (velocityTrends.trend) {
      case 'increasing':
        return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'decreasing':
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'volatile':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* AI Generated Insights */}
      {conversationalAnswer && (
        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <h3 className="text-lg font-semibold text-rh-text">Analytics Insights</h3>
          </div>
          <div className="prose prose-invert max-w-none text-rh-text-secondary whitespace-pre-wrap">
            {conversationalAnswer.split('\n').map((line, idx) => {
              // Handle bold markdown
              const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-rh-green font-semibold">$1</strong>');
              // Handle bullet points
              const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
              return (
                <p key={idx} className={isBullet ? 'ml-4' : ''}>
                  <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
                </p>
              );
            })}
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Velocity */}
        <div className="bg-rh-card border border-rh-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-rh-text-secondary">Avg Velocity</span>
            <Target className="w-4 h-4 text-rh-green" />
          </div>
          <div className="text-2xl font-bold text-rh-text">{teamMetrics.averageVelocity}</div>
          <div className="text-xs text-rh-text-secondary mt-1">story points/sprint</div>
        </div>

        {/* Velocity Trend */}
        <div className={`border rounded-lg p-4 ${getTrendColor()}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Velocity Trend</span>
            {getTrendIcon()}
          </div>
          <div className="text-2xl font-bold capitalize">{velocityTrends.trend}</div>
          <div className="text-xs mt-1">
            {velocityTrends.changePercentage > 0 ? '+' : ''}{velocityTrends.changePercentage}% change
          </div>
        </div>

        {/* Cycle Time */}
        <div className="bg-rh-card border border-rh-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-rh-text-secondary">Avg Cycle Time</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-rh-text">{cycleTime.averageDays}</div>
          <div className="text-xs text-rh-text-secondary mt-1">days (median: {cycleTime.medianDays}d)</div>
        </div>

        {/* Team Size */}
        <div className="bg-rh-card border border-rh-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-rh-text-secondary">Team Size</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-rh-text">{teamMetrics.teamMembers.length}</div>
          <div className="text-xs text-rh-text-secondary mt-1">
            {teamMetrics.completedStoryPoints}/{teamMetrics.totalStoryPoints} SP completed
          </div>
        </div>
      </div>

      {/* Sprint Velocity Chart */}
      {velocityChartData.length > 0 && (
        <div className="bg-rh-card border border-rh-border rounded-lg p-6">
          <h4 className="text-lg font-semibold text-rh-text mb-4">Sprint Velocity Trend</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={velocityChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#10B981"
                name="Completed SP"
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="planned"
                stroke="#6B7280"
                name="Planned SP"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#6B7280', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Team Distribution Chart */}
      {teamChartData.length > 0 && (
        <div className="bg-rh-card border border-rh-border rounded-lg p-6">
          <h4 className="text-lg font-semibold text-rh-text mb-4">Story Points by Team Member</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="points" fill="#3B82F6" name="Story Points" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recommendations */}
      {velocityTrends.recommendations.length > 0 && (
        <div className="bg-rh-card border border-yellow-500/30 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-rh-text mb-3 flex items-center gap-2">
            <span className="text-yellow-500">💡</span>
            Recommendations
          </h4>
          <ul className="space-y-2">
            {velocityTrends.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-rh-text-secondary flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cycle Time Breakdown */}
      {Object.keys(cycleTime.byType).length > 0 && (
        <div className="bg-rh-card border border-rh-border rounded-lg p-6">
          <h4 className="text-lg font-semibold text-rh-text mb-4">Cycle Time by Work Item Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(cycleTime.byType).map(([type, days]) => (
              <div key={type} className="text-center p-3 bg-rh-dark rounded-lg border border-rh-border">
                <div className="text-sm text-rh-text-secondary mb-1">{type}</div>
                <div className="text-xl font-bold text-rh-text">{days}d</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
