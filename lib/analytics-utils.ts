/**
 * Analytics utilities for calculating metrics and insights from work items
 */

import { WorkItem } from '@/types';

export interface SprintVelocity {
  iteration: string;
  iterationPath: string;
  storyPointsCompleted: number;
  storyPointsPlanned: number;
  itemsCompleted: number;
  itemsPlanned: number;
  completionRate: number;
  startDate?: Date;
  endDate?: Date;
}

export interface TeamMetrics {
  totalStoryPoints: number;
  completedStoryPoints: number;
  averageVelocity: number;
  teamMembers: string[];
  workItemsByMember: Record<string, number>;
  storyPointsByMember: Record<string, number>;
}

export interface TimeSeriesMetric {
  date: string;
  value: number;
  label: string;
}

export interface AnalyticsResult {
  type: 'velocity' | 'throughput' | 'cycle_time' | 'team_performance' | 'trend_analysis';
  summary: string;
  metrics: any;
  insights: string[];
  visualizations: Array<{
    chartType: 'line' | 'bar' | 'area' | 'pie';
    dataKey: string;
    data: any[];
    title: string;
  }>;
}

/**
 * Calculate sprint velocity metrics from work items
 *
 * IMPORTANT: Sprints = Iterations in Azure DevOps
 * Tickets are assigned to sprints via the System.IterationPath field
 * Example path: "Marketing Experience\\MX Sprint 2025.11.12 (23)"
 */
export function calculateSprintVelocity(workItems: WorkItem[]): SprintVelocity[] {
  const iterationMap = new Map<string, WorkItem[]>();

  // Group work items by iteration (sprint)
  // Each ticket's iterationPath determines which sprint it belongs to
  workItems.forEach(item => {
    const iteration = item.iterationPath || 'No Sprint';
    if (!iterationMap.has(iteration)) {
      iterationMap.set(iteration, []);
    }
    iterationMap.get(iteration)!.push(item);
  });

  // Calculate velocity for each iteration
  const velocities: SprintVelocity[] = [];

  iterationMap.forEach((items, iterationPath) => {
    const completedItems = items.filter(item =>
      item.state === 'Done' || item.state === 'Closed' || item.state === 'Resolved'
    );

    const storyPointsCompleted = completedItems.reduce((sum, item) =>
      sum + (item.storyPoints || 0), 0
    );

    const storyPointsPlanned = items.reduce((sum, item) =>
      sum + (item.storyPoints || 0), 0
    );

    const completionRate = storyPointsPlanned > 0
      ? (storyPointsCompleted / storyPointsPlanned) * 100
      : 0;

    // Extract sprint name (last part of path)
    const iteration = iterationPath.split('\\').pop() || iterationPath;

    velocities.push({
      iteration,
      iterationPath,
      storyPointsCompleted,
      storyPointsPlanned,
      itemsCompleted: completedItems.length,
      itemsPlanned: items.length,
      completionRate: Math.round(completionRate * 10) / 10,
    });
  });

  // Sort by iteration name (attempt to sort chronologically)
  velocities.sort((a, b) => a.iteration.localeCompare(b.iteration));

  return velocities;
}

/**
 * Calculate team performance metrics
 */
export function calculateTeamMetrics(workItems: WorkItem[]): TeamMetrics {
  const teamMembers = new Set<string>();
  const workItemsByMember: Record<string, number> = {};
  const storyPointsByMember: Record<string, number> = {};

  let totalStoryPoints = 0;
  let completedStoryPoints = 0;

  workItems.forEach(item => {
    const assignee = item.assignedTo || 'Unassigned';
    teamMembers.add(assignee);

    // Count work items per member
    workItemsByMember[assignee] = (workItemsByMember[assignee] || 0) + 1;

    // Count story points
    const points = item.storyPoints || 0;
    totalStoryPoints += points;
    storyPointsByMember[assignee] = (storyPointsByMember[assignee] || 0) + points;

    // Count completed story points
    if (item.state === 'Done' || item.state === 'Closed' || item.state === 'Resolved') {
      completedStoryPoints += points;
    }
  });

  // Calculate average velocity (completed story points per sprint)
  const velocities = calculateSprintVelocity(workItems);
  const averageVelocity = velocities.length > 0
    ? velocities.reduce((sum, v) => sum + v.storyPointsCompleted, 0) / velocities.length
    : 0;

  return {
    totalStoryPoints,
    completedStoryPoints,
    averageVelocity: Math.round(averageVelocity * 10) / 10,
    teamMembers: Array.from(teamMembers),
    workItemsByMember,
    storyPointsByMember,
  };
}

/**
 * Calculate throughput (items completed over time)
 */
export function calculateThroughput(workItems: WorkItem[]): TimeSeriesMetric[] {
  const completedItems = workItems.filter(item =>
    item.state === 'Done' || item.state === 'Closed' || item.state === 'Resolved'
  );

  // Group by month
  const monthlyThroughput = new Map<string, number>();

  completedItems.forEach(item => {
    if (item.closedDate) {
      const date = new Date(item.closedDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyThroughput.set(monthKey, (monthlyThroughput.get(monthKey) || 0) + 1);
    }
  });

  // Convert to array and sort
  const throughput: TimeSeriesMetric[] = [];
  monthlyThroughput.forEach((value, date) => {
    throughput.push({
      date,
      value,
      label: `${value} items`,
    });
  });

  throughput.sort((a, b) => a.date.localeCompare(b.date));

  return throughput;
}

/**
 * Calculate cycle time (time from created to closed)
 */
export function calculateCycleTime(workItems: WorkItem[]): {
  averageDays: number;
  medianDays: number;
  byType: Record<string, number>;
} {
  const completedItems = workItems.filter(item =>
    (item.state === 'Done' || item.state === 'Closed' || item.state === 'Resolved') &&
    item.createdDate && item.closedDate
  );

  const cycleTimes: number[] = [];
  const cycleTimesByType: Record<string, number[]> = {};

  completedItems.forEach(item => {
    const created = new Date(item.createdDate!).getTime();
    const closed = new Date(item.closedDate!).getTime();
    const days = (closed - created) / (1000 * 60 * 60 * 24);

    cycleTimes.push(days);

    const type = item.type;
    if (!cycleTimesByType[type]) {
      cycleTimesByType[type] = [];
    }
    cycleTimesByType[type].push(days);
  });

  // Calculate average
  const averageDays = cycleTimes.length > 0
    ? cycleTimes.reduce((sum, d) => sum + d, 0) / cycleTimes.length
    : 0;

  // Calculate median
  const sortedTimes = [...cycleTimes].sort((a, b) => a - b);
  const medianDays = sortedTimes.length > 0
    ? sortedTimes[Math.floor(sortedTimes.length / 2)]
    : 0;

  // Calculate average by type
  const byType: Record<string, number> = {};
  Object.entries(cycleTimesByType).forEach(([type, times]) => {
    byType[type] = Math.round((times.reduce((sum, t) => sum + t, 0) / times.length) * 10) / 10;
  });

  return {
    averageDays: Math.round(averageDays * 10) / 10,
    medianDays: Math.round(medianDays * 10) / 10,
    byType,
  };
}

/**
 * Analyze velocity trends and identify patterns
 */
export function analyzeVelocityTrends(velocities: SprintVelocity[]): {
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changePercentage: number;
  consistency: number; // 0-100, higher is more consistent
  recommendations: string[];
} {
  if (velocities.length < 2) {
    return {
      trend: 'stable',
      changePercentage: 0,
      consistency: 100,
      recommendations: ['Need more sprint data for trend analysis'],
    };
  }

  // Calculate trend
  const firstHalf = velocities.slice(0, Math.floor(velocities.length / 2));
  const secondHalf = velocities.slice(Math.floor(velocities.length / 2));

  const avgFirstHalf = firstHalf.reduce((sum, v) => sum + v.storyPointsCompleted, 0) / firstHalf.length;
  const avgSecondHalf = secondHalf.reduce((sum, v) => sum + v.storyPointsCompleted, 0) / secondHalf.length;

  const changePercentage = avgFirstHalf > 0
    ? ((avgSecondHalf - avgFirstHalf) / avgFirstHalf) * 100
    : 0;

  // Determine trend
  let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';
  if (Math.abs(changePercentage) > 20) {
    trend = changePercentage > 0 ? 'increasing' : 'decreasing';
  } else if (Math.abs(changePercentage) < 10) {
    trend = 'stable';
  }

  // Calculate consistency (coefficient of variation)
  const velocityValues = velocities.map(v => v.storyPointsCompleted);
  const mean = velocityValues.reduce((sum, v) => sum + v, 0) / velocityValues.length;
  const variance = velocityValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocityValues.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (stdDev / mean) * 100 : 0;
  const consistency = Math.max(0, Math.min(100, 100 - coefficientOfVariation));

  // Check for volatility
  if (consistency < 50) {
    trend = 'volatile';
  }

  // Generate recommendations
  const recommendations: string[] = [];
  if (trend === 'decreasing') {
    recommendations.push('Velocity is declining - investigate team capacity, technical debt, or scope creep');
    recommendations.push('Consider sprint retrospectives to identify blockers');
  } else if (trend === 'increasing') {
    recommendations.push('Velocity is improving - team is gaining momentum');
    recommendations.push('Ensure quality is maintained alongside increased throughput');
  } else if (trend === 'volatile') {
    recommendations.push('Velocity is inconsistent - review sprint planning and estimation accuracy');
    recommendations.push('Consider stabilizing sprint scope and team composition');
  } else {
    recommendations.push('Velocity is stable - team has predictable capacity');
    recommendations.push('Focus on continuous improvement and quality enhancements');
  }

  // Check completion rates
  const avgCompletionRate = velocities.reduce((sum, v) => sum + v.completionRate, 0) / velocities.length;
  if (avgCompletionRate < 80) {
    recommendations.push(`Average completion rate is ${Math.round(avgCompletionRate)}% - consider reducing sprint commitments`);
  }

  return {
    trend,
    changePercentage: Math.round(changePercentage * 10) / 10,
    consistency: Math.round(consistency * 10) / 10,
    recommendations,
  };
}

/**
 * Prepare analytics summary for AI analysis
 */
export function prepareAnalyticsSummary(workItems: WorkItem[]): string {
  const velocities = calculateSprintVelocity(workItems);
  const teamMetrics = calculateTeamMetrics(workItems);
  const trends = analyzeVelocityTrends(velocities);
  const cycleTime = calculateCycleTime(workItems);

  const summary = `
ANALYTICS SUMMARY FOR ${workItems.length} WORK ITEMS

SPRINT VELOCITY:
${velocities.map(v =>
  `• ${v.iteration}: ${v.storyPointsCompleted} SP completed (${v.completionRate}% of ${v.storyPointsPlanned} SP planned)`
).join('\n')}

VELOCITY TRENDS:
• Trend: ${trends.trend.toUpperCase()}
• Change: ${trends.changePercentage > 0 ? '+' : ''}${trends.changePercentage}%
• Consistency Score: ${trends.consistency}/100

TEAM METRICS:
• Average Velocity: ${teamMetrics.averageVelocity} SP per sprint
• Total Story Points: ${teamMetrics.totalStoryPoints} (${teamMetrics.completedStoryPoints} completed)
• Team Size: ${teamMetrics.teamMembers.length} members
• Top Contributors: ${Object.entries(teamMetrics.storyPointsByMember)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, points]) => `${name} (${points} SP)`)
    .join(', ')}

CYCLE TIME:
• Average: ${cycleTime.averageDays} days
• Median: ${cycleTime.medianDays} days
• By Type: ${Object.entries(cycleTime.byType).map(([type, days]) => `${type}: ${days}d`).join(', ')}

KEY INSIGHTS:
${trends.recommendations.map(r => `• ${r}`).join('\n')}
`;

  return summary;
}
