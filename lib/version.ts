export const VERSION = 'v1.2';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    category: 'Feature' | 'Enhancement' | 'Fix';
    description: string;
  }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v1.2',
    date: '2025-01-06',
    changes: [
      {
        category: 'Feature',
        description: 'Interactive Chart Creation - Create charts directly from search results with one-click Chart button and dropdown menu',
      },
      {
        category: 'Feature',
        description: 'Dynamic Pivot Selection - Change chart grouping on-the-fly between State, Type, Priority, Assigned To, and Created By',
      },
      {
        category: 'Feature',
        description: 'Project-Based Charts - Chart command now supports project selection to visualize specific project data',
      },
      {
        category: 'Feature',
        description: 'Grid Modal Charts - Create charts from filtered results in the grid modal with dedicated chart popup view',
      },
      {
        category: 'Enhancement',
        description: 'Improved dropdown visibility - Sprint and all dropdowns now show friendly names instead of GUIDs',
      },
      {
        category: 'Enhancement',
        description: 'Wider dropdown menus (256px → 384px) for better readability of long project and sprint names',
      },
      {
        category: 'Enhancement',
        description: 'Blue chart buttons for improved visibility and easier discovery of chart features',
      },
    ],
  },
  {
    version: 'v1.1',
    date: '2025-01-05',
    changes: [
      {
        category: 'Feature',
        description: 'Sprint/Iteration Support - Query work items by sprint, view current sprint, and filter by iteration path',
      },
      {
        category: 'Feature',
        description: 'Chart Visualizations - Create pie, bar, line, and area charts from search results to analyze work item distribution',
      },
      {
        category: 'Enhancement',
        description: 'Improved natural language AI understanding for sprint-related queries',
      },
      {
        category: 'Enhancement',
        description: 'Added sprint and chart command templates with interactive dropdowns',
      },
    ],
  },
  {
    version: 'v1.0',
    date: '2024-12-01',
    changes: [
      {
        category: 'Feature',
        description: 'Initial release - Chat-based Azure DevOps work item search',
      },
      {
        category: 'Feature',
        description: 'Natural language query processing with AI',
      },
      {
        category: 'Feature',
        description: 'Relationship mapping and visualization',
      },
      {
        category: 'Feature',
        description: 'Work item details with discussion threads',
      },
      {
        category: 'Feature',
        description: 'Global filters for refined searching',
      },
    ],
  },
];
