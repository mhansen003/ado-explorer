/**
 * Centralized color mapping for work item types and states
 * Ensures consistent styling across all components
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
  switch (type.toLowerCase()) {
    case 'bug':
      return 'text-red-400 bg-red-400/10';
    case 'task':
      return 'text-blue-400 bg-blue-400/10';
    case 'user story':
      return 'text-purple-400 bg-purple-400/10';
    case 'epic':
      return 'text-orange-400 bg-orange-400/10';
    case 'feature':
      return 'text-green-400 bg-green-400/10';
    case 'issue':
      return 'text-yellow-400 bg-yellow-400/10';
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
  switch (type.toLowerCase()) {
    case 'bug':
      return {
        text: 'text-red-400',
        bg: 'bg-red-400/10',
        border: 'border-red-400/30',
      };
    case 'task':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-400/10',
        border: 'border-blue-400/30',
      };
    case 'user story':
      return {
        text: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/30',
      };
    case 'epic':
      return {
        text: 'text-orange-400',
        bg: 'bg-orange-400/10',
        border: 'border-orange-400/30',
      };
    case 'feature':
      return {
        text: 'text-green-400',
        bg: 'bg-green-400/10',
        border: 'border-green-400/30',
      };
    case 'issue':
      return {
        text: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        border: 'border-yellow-400/30',
      };
    default:
      return {
        text: 'text-gray-400',
        bg: 'bg-gray-400/10',
        border: 'border-gray-400/30',
      };
  }
}
