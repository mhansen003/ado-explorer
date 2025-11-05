import { CommandTemplate } from '@/types';

export const COMMAND_TEMPLATES: CommandTemplate[] = [
  // By Creator
  {
    id: 'created-by',
    displayText: 'Show me all tickets created by {user}',
    description: 'Find tickets by who created them',
    icon: '👤',
    placeholders: [
      { key: 'user', type: 'user', label: 'created by', required: true }
    ],
    buildCommand: (values) => `/created_by ${values.user}`
  },

  // By Assignee
  {
    id: 'assigned-to',
    displayText: 'Show me all tickets assigned to {user}',
    description: 'Find tickets by who they\'re assigned to',
    icon: '📌',
    placeholders: [
      { key: 'user', type: 'user', label: 'assigned to', required: true }
    ],
    buildCommand: (values) => `/assigned_to ${values.user}`
  },

  // By Status
  {
    id: 'by-status',
    displayText: 'Show me all tickets with status {state}',
    description: 'Filter tickets by their current state',
    icon: '📊',
    placeholders: [
      { key: 'state', type: 'state', label: 'status', required: true }
    ],
    buildCommand: (values) => `/state ${values.state}`
  },

  // By Type
  {
    id: 'by-type',
    displayText: 'Show me all {type} tickets',
    description: 'Filter by work item type',
    icon: '🏷️',
    placeholders: [
      { key: 'type', type: 'type', label: 'type', required: true }
    ],
    buildCommand: (values) => `/type ${values.type}`
  },

  // By Project
  {
    id: 'by-project',
    displayText: 'Show me all tickets for project {project}',
    description: 'See all work items in a specific project',
    icon: '📁',
    placeholders: [
      { key: 'project', type: 'project', label: 'project', required: true }
    ],
    buildCommand: (values) => `/project ${values.project}`
  },

  // By Board
  {
    id: 'by-board',
    displayText: 'Show me all tickets on board {board}',
    description: 'View work items for a specific board/team',
    icon: '📋',
    placeholders: [
      { key: 'board', type: 'board', label: 'board', required: true }
    ],
    buildCommand: (values) => `/board ${values.board}`
  },

  // By Tags (Multi-select)
  {
    id: 'by-tags',
    displayText: 'Show me all tickets tagged with {tag}',
    description: 'Filter by one or more tags',
    icon: '🔖',
    placeholders: [
      { key: 'tag', type: 'tag', label: 'tags', required: true, multiSelect: true }
    ],
    buildCommand: (values) => {
      const tags = Array.isArray(values.tag) ? values.tag.join(', ') : values.tag;
      return `/tag ${tags}`;
    }
  },

  // By Saved Query
  {
    id: 'by-query',
    displayText: 'Show me all tickets based on query {query}',
    description: 'Run a saved Azure DevOps query',
    icon: '🔍',
    placeholders: [
      { key: 'query', type: 'query', label: 'saved query', required: true }
    ],
    buildCommand: (values) => `/query ${values.query}`
  },

  // Current Sprint
  {
    id: 'current-sprint',
    displayText: 'Show me items in the current sprint',
    description: 'View all work items in the active sprint',
    icon: '🏃',
    placeholders: [],
    buildCommand: () => `/current-sprint`
  },

  // By Sprint
  {
    id: 'by-sprint',
    displayText: 'Show me all tickets in {sprint}',
    description: 'View work items for a specific sprint/iteration',
    icon: '📅',
    placeholders: [
      { key: 'sprint', type: 'sprint', label: 'sprint', required: true }
    ],
    buildCommand: (values) => `/sprint ${values.sprint}`
  },

  // Recent tickets
  {
    id: 'recent',
    displayText: 'Show me recent tickets',
    description: 'View recently updated work items (last 7 days)',
    icon: '⏰',
    placeholders: [],
    buildCommand: () => `/recent`
  },

  // By ID (Direct lookup)
  {
    id: 'by-id',
    displayText: 'Show me ticket #{id}',
    description: 'Look up a specific work item by ID',
    icon: '🎯',
    placeholders: [
      { key: 'id', type: 'text', label: 'ticket ID', required: true }
    ],
    buildCommand: (values) => `/id ${values.id}`
  },

  // Chart
  {
    id: 'create-chart',
    displayText: 'Create a {chartType} chart showing {chartDimension}',
    description: 'Visualize work items with charts',
    icon: '📊',
    placeholders: [
      { key: 'chartType', type: 'chartType', label: 'chart type', required: true },
      { key: 'chartDimension', type: 'chartDimension', label: 'dimension', required: true }
    ],
    buildCommand: (values) => `/chart ${values.chartType} ${values.chartDimension}`
  },

  // Help
  {
    id: 'help',
    displayText: 'Show help',
    description: 'View all available commands and tips',
    icon: '❓',
    placeholders: [],
    buildCommand: () => `/help`
  }
];

// Helper function to get template by ID
export function getTemplateById(id: string): CommandTemplate | undefined {
  return COMMAND_TEMPLATES.find(t => t.id === id);
}

// Helper function to parse placeholder keys from displayText
export function extractPlaceholderKeys(displayText: string): string[] {
  const regex = /\{(\w+)\}/g;
  const keys: string[] = [];
  let match;
  while ((match = regex.exec(displayText)) !== null) {
    keys.push(match[1]);
  }
  return keys;
}
