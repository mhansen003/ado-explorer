export const VERSION = 'v1.1';

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
