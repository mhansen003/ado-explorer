'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import WorkItemCard from './WorkItemCard';
import { HierarchicalWorkItem } from '@/lib/hierarchy-utils';

interface HierarchicalWorkItemListProps {
  items: HierarchicalWorkItem[];
  maxInitialItems?: number;
}

interface HierarchicalItemProps {
  item: HierarchicalWorkItem;
  isLast: boolean;
}

function HierarchicalItem({ item, isLast }: HierarchicalItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const level = item.level || 0;

  return (
    <div className="relative">
      {/* Indent based on level */}
      <div style={{ marginLeft: `${level * 24}px` }}>
        {/* Show expand/collapse button if has children */}
        {hasChildren && level === 0 && (
          <div className="flex items-start gap-2 mb-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-4 p-1 hover:bg-rh-border rounded transition-colors flex-shrink-0"
              aria-label={isExpanded ? 'Collapse children' : 'Expand children'}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-rh-text-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-rh-text-secondary" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-xs font-medium text-rh-text-secondary px-2 py-0.5 bg-rh-border rounded">
                  {item.relationType || 'Parent'}
                </div>
                {hasChildren && (
                  <span className="text-xs text-rh-text-secondary">
                    {item.children!.length} {item.children!.length === 1 ? 'child' : 'children'}
                  </span>
                )}
              </div>
              <WorkItemCard workItem={item} />
            </div>
          </div>
        )}

        {/* No children or is a child itself */}
        {(!hasChildren || level > 0) && (
          <div className="relative">
            {level > 0 && (
              <div className="flex items-start gap-2 mb-2">
                {/* Connection line */}
                <div className="relative flex-shrink-0 pt-4">
                  <div className="w-4 border-l-2 border-b-2 border-rh-border rounded-bl h-6" />
                </div>
                <div className="flex-1">
                  <div className="mb-1">
                    <div className="text-xs font-medium text-rh-text-secondary px-2 py-0.5 bg-rh-border rounded inline-block">
                      {item.relationType || 'Child'}
                    </div>
                  </div>
                  <WorkItemCard workItem={item} />
                </div>
              </div>
            )}
            {level === 0 && (
              <div className="mb-2">
                {item.relationType && (
                  <div className="mb-1">
                    <div className="text-xs font-medium text-rh-text-secondary px-2 py-0.5 bg-rh-border rounded inline-block">
                      {item.relationType}
                    </div>
                  </div>
                )}
                <WorkItemCard workItem={item} />
              </div>
            )}
          </div>
        )}

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="mt-0">
            {item.children!.map((child, index) => (
              <HierarchicalItem
                key={child.id}
                item={child}
                isLast={index === item.children!.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HierarchicalWorkItemList({
  items,
  maxInitialItems = 5,
}: HierarchicalWorkItemListProps) {
  const [showAll, setShowAll] = useState(false);

  const displayItems = showAll ? items : items.slice(0, maxInitialItems);
  const hasMore = items.length > maxInitialItems;

  return (
    <div className="space-y-2">
      {displayItems.map((item, index) => (
        <HierarchicalItem
          key={item.id}
          item={item}
          isLast={index === displayItems.length - 1}
        />
      ))}

      {/* Show "and X more" button */}
      {hasMore && !showAll && (
        <div className="text-center py-3">
          <button
            onClick={() => setShowAll(true)}
            className="text-sm text-rh-green hover:text-green-400 transition-colors"
          >
            ... and {items.length - maxInitialItems} more items
          </button>
        </div>
      )}

      {/* Show "show less" button */}
      {showAll && hasMore && (
        <div className="text-center py-3">
          <button
            onClick={() => setShowAll(false)}
            className="text-sm text-rh-text-secondary hover:text-rh-text transition-colors"
          >
            Show less
          </button>
        </div>
      )}
    </div>
  );
}
