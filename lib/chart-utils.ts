import { WorkItem, ChartData } from '@/types';

// Color mapping for common states
const STATE_COLORS: Record<string, string> = {
  'New': '#3B82F6',
  'Active': '#10B981',
  'Resolved': '#F59E0B',
  'Closed': '#6B7280',
  'Removed': '#EF4444',
};

// Color mapping for common work item types
const TYPE_COLORS: Record<string, string> = {
  'Bug': '#EF4444',
  'Task': '#3B82F6',
  'User Story': '#10B981',
  'Epic': '#8B5CF6',
  'Feature': '#F59E0B',
  'Issue': '#EC4899',
};

// Color mapping for priorities
const PRIORITY_COLORS: Record<number, string> = {
  1: '#EF4444', // P1 - Red (Highest)
  2: '#F59E0B', // P2 - Orange
  3: '#10B981', // P3 - Green
  4: '#3B82F6', // P4 - Blue (Lowest)
};

/**
 * Process work items into chart data based on a grouping key
 */
export function processWorkItemsToChartData(
  workItems: WorkItem[],
  chartType: 'pie' | 'bar' | 'line' | 'area',
  dataKey: 'state' | 'type' | 'priority' | 'assignedTo' | 'createdBy' | 'project' | 'areaPath' | 'changedBy' | 'iterationPath' | 'storyPoints' | 'tags'
): ChartData {
  // Group work items by the specified key
  const grouped: Record<string, number> = {};

  workItems.forEach(item => {
    let keys: string[] = [];

    switch (dataKey) {
      case 'state':
        keys = [item.state];
        break;
      case 'type':
        keys = [item.type];
        break;
      case 'priority':
        keys = [`P${item.priority}`];
        break;
      case 'assignedTo':
        keys = [item.assignedTo || 'Unassigned'];
        break;
      case 'createdBy':
        keys = [item.createdBy];
        break;
      case 'project':
        keys = [item.project || 'No Project'];
        break;
      case 'areaPath':
        // Extract last part of area path for cleaner display
        const areaPath = item.areaPath || 'No Area';
        keys = [areaPath.split('\\').pop() || areaPath];
        break;
      case 'changedBy':
        keys = [item.changedBy || 'Unknown'];
        break;
      case 'iterationPath':
        // Extract last part of iteration path (sprint name)
        const iterPath = item.iterationPath || 'No Sprint';
        keys = [iterPath.split('\\').pop() || iterPath];
        break;
      case 'storyPoints':
        const points = item.storyPoints ?? 0;
        keys = [points === 0 ? 'No Story Points' : `${points} SP`];
        break;
      case 'tags':
        // For tags, count each tag separately
        keys = item.tags && item.tags.length > 0 ? item.tags : ['No Tags'];
        break;
      default:
        keys = ['Unknown'];
    }

    // Count each key (handles both single values and arrays like tags)
    keys.forEach(key => {
      grouped[key] = (grouped[key] || 0) + 1;
    });
  });

  // Convert to chart data format
  const data = Object.entries(grouped)
    .map(([name, value]) => {
      let color: string | undefined;

      // Assign colors based on data key
      if (dataKey === 'state') {
        color = STATE_COLORS[name];
      } else if (dataKey === 'type') {
        color = TYPE_COLORS[name];
      } else if (dataKey === 'priority') {
        const priorityNum = parseInt(name.replace('P', ''));
        color = PRIORITY_COLORS[priorityNum];
      }

      return {
        name,
        value,
        color,
      };
    })
    // Sort by value descending
    .sort((a, b) => b.value - a.value);

  return {
    chartType,
    dataKey,
    data,
  };
}

/**
 * Get human-readable label for data key
 */
export function getDataKeyLabel(dataKey: string): string {
  const labels: Record<string, string> = {
    state: 'State',
    type: 'Type',
    priority: 'Priority',
    assignedTo: 'Assigned To',
    createdBy: 'Created By',
    project: 'Project',
    areaPath: 'Area',
    changedBy: 'Changed By',
    iterationPath: 'Sprint/Iteration',
    storyPoints: 'Story Points',
    tags: 'Tags',
  };

  return labels[dataKey] || dataKey;
}

/**
 * Get suggested chart type for a data key
 */
export function getSuggestedChartType(dataKey: string): 'pie' | 'bar' | 'line' | 'area' {
  // Pie charts work well for states and types (categorical)
  if (dataKey === 'state' || dataKey === 'type' || dataKey === 'priority') {
    return 'pie';
  }

  // Bar charts work well for people (assignedTo, createdBy)
  return 'bar';
}
