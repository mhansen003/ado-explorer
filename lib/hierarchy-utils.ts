/**
 * Utility functions for building and working with work item hierarchies
 */

import { WorkItem } from '@/types';

export interface HierarchicalWorkItem extends WorkItem {
  children?: HierarchicalWorkItem[];
  level?: number;
  hasChildren?: boolean;
}

/**
 * Build a hierarchical structure from flat work items based on their relations
 */
export function buildHierarchy(workItems: WorkItem[]): {
  roots: HierarchicalWorkItem[];
  hasHierarchy: boolean;
} {
  // Check if any items have parent/child relationships
  const hasRelations = workItems.some(item =>
    item.relationType === 'Parent' || item.relationType === 'Child'
  );

  if (!hasRelations) {
    // No hierarchy, return all as roots
    return {
      roots: workItems.map(item => ({ ...item, level: 0 })),
      hasHierarchy: false,
    };
  }

  // Create a map of items by ID for quick lookup
  const itemMap = new Map<string, HierarchicalWorkItem>();
  workItems.forEach(item => {
    itemMap.set(item.id, { ...item, children: [], level: 0, hasChildren: false });
  });

  // Separate parents and children
  const roots: HierarchicalWorkItem[] = [];
  const children: HierarchicalWorkItem[] = [];

  workItems.forEach(item => {
    const hierarchicalItem = itemMap.get(item.id)!;

    if (item.relationType === 'Parent') {
      roots.push(hierarchicalItem);
    } else if (item.relationType === 'Child') {
      children.push(hierarchicalItem);
    } else {
      // No relation type, treat as root
      roots.push(hierarchicalItem);
    }
  });

  // Try to match children to parents
  // This is best-effort since we don't have explicit parent IDs in the current structure
  // We'll group children under the first parent item
  if (roots.length > 0 && children.length > 0) {
    const firstParent = roots[0];
    children.forEach(child => {
      child.level = 1;
      firstParent.children!.push(child);
    });
    firstParent.hasChildren = true;
  }

  // If no parents but have children, all items are at root level
  if (roots.length === 0) {
    return {
      roots: workItems.map(item => ({ ...item, level: 0 })),
      hasHierarchy: false,
    };
  }

  return {
    roots,
    hasHierarchy: true,
  };
}

/**
 * Alternative grouping: Group by relation type
 */
export function groupByRelationType(workItems: WorkItem[]): {
  parents: WorkItem[];
  children: WorkItem[];
  related: WorkItem[];
  unrelated: WorkItem[];
} {
  const parents: WorkItem[] = [];
  const children: WorkItem[] = [];
  const related: WorkItem[] = [];
  const unrelated: WorkItem[] = [];

  workItems.forEach(item => {
    switch (item.relationType) {
      case 'Parent':
        parents.push(item);
        break;
      case 'Child':
        children.push(item);
        break;
      case 'Related':
        related.push(item);
        break;
      default:
        unrelated.push(item);
        break;
    }
  });

  return { parents, children, related, unrelated };
}

/**
 * Check if work items have any hierarchical relationships
 */
export function hasHierarchicalRelations(workItems: WorkItem[]): boolean {
  return workItems.some(item =>
    item.relationType && ['Parent', 'Child'].includes(item.relationType)
  );
}

/**
 * Count items at each level
 */
export function countByRelationType(workItems: WorkItem[]): {
  parents: number;
  children: number;
  related: number;
  unrelated: number;
} {
  const groups = groupByRelationType(workItems);
  return {
    parents: groups.parents.length,
    children: groups.children.length,
    related: groups.related.length,
    unrelated: groups.unrelated.length,
  };
}
