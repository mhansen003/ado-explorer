/**
 * Centralized color mapping for work item types and states
 * Ensures consistent styling across all components
 *
 * Color Scheme (aligned with ADO):
 * - Epics: Orange
 * - Features: Purple
 * - User Stories: Blue
 * - Tasks: Gray
 * - Test Cases: Green
 * - Spikes: Dark Green (emerald)
 * - Defects: Yellow
 * - Bugs: Red
 */

export interface ColorClasses {
  text: string;
  bg: string;
  border?: string;
}

/**
 * Get Tailwind CSS classes for work item type badges
 * @param type - Work item type (Bug, Task, User Story, etc.)
 * @returns Color classes for text and background
 */
export function getTypeColor(type: string): string {
  const normalizedType = type.toLowerCase().trim();

  switch (normalizedType) {
    // Red for Bugs
    case 'bug':
      return 'text-red-400 bg-red-400/10';

    // Yellow for Defects
    case 'defect':
    case 'issue':
      return 'text-yellow-400 bg-yellow-400/10';

    // Gray for Tasks
    case 'task':
      return 'text-gray-400 bg-gray-400/10';

    // Blue for User Stories
    case 'user story':
    case 'story':
      return 'text-blue-400 bg-blue-400/10';

    // Purple for Features
    case 'feature':
      return 'text-purple-400 bg-purple-400/10';

    // Orange for Epics
    case 'epic':
      return 'text-orange-400 bg-orange-400/10';

    // Green for Test Cases
    case 'test case':
    case 'test':
      return 'text-green-400 bg-green-400/10';

    // Dark Green (emerald) for Spikes
    case 'spike':
      return 'text-emerald-600 bg-emerald-600/10';

    // Default gray for unknown types
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
}

/**
 * Get Tailwind CSS classes for work item state text
 * @param state - Work item state (New, Active, Resolved, Closed, etc.)
 * @returns Color class for text
 */
export function getStateColor(state: string): string {
  switch (state.toLowerCase()) {
    case 'active':
    case 'in progress':
    case 'doing':
      return 'text-blue-400';
    case 'resolved':
    case 'closed':
    case 'done':
    case 'completed':
      return 'text-green-400';
    case 'new':
    case 'to do':
    case 'open':
      return 'text-yellow-400';
    case 'removed':
    case 'canceled':
    case 'cancelled':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get combined color classes for type badges with border
 * Used in table views and detailed displays
 * @param type - Work item type
 * @returns Object with text, bg, and border classes
 */
export function getTypeColorDetailed(type: string): ColorClasses {
  const normalizedType = type.toLowerCase().trim();

  switch (normalizedType) {
    // Red for Bugs
    case 'bug':
      return {
        text: 'text-red-400',
        bg: 'bg-red-400/10',
        border: 'border-red-400/30',
      };

    // Yellow for Defects
    case 'defect':
    case 'issue':
      return {
        text: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        border: 'border-yellow-400/30',
      };

    // Gray for Tasks
    case 'task':
      return {
        text: 'text-gray-400',
        bg: 'bg-gray-400/10',
        border: 'border-gray-400/30',
      };

    // Blue for User Stories
    case 'user story':
    case 'story':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-400/10',
        border: 'border-blue-400/30',
      };

    // Purple for Features
    case 'feature':
      return {
        text: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/30',
      };

    // Orange for Epics
    case 'epic':
      return {
        text: 'text-orange-400',
        bg: 'bg-orange-400/10',
        border: 'border-orange-400/30',
      };

    // Green for Test Cases
    case 'test case':
    case 'test':
      return {
        text: 'text-green-400',
        bg: 'bg-green-400/10',
        border: 'border-green-400/30',
      };

    // Dark Green (emerald) for Spikes
    case 'spike':
      return {
        text: 'text-emerald-600',
        bg: 'bg-emerald-600/10',
        border: 'border-emerald-600/30',
      };

    // Default gray for unknown types
    default:
      return {
        text: 'text-gray-400',
        bg: 'bg-gray-400/10',
        border: 'border-gray-400/30',
      };
  }
}
