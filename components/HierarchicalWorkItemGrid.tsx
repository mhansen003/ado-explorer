'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import WorkItemDetailModal from './WorkItemDetailModal';
import { HierarchicalWorkItem } from '@/lib/hierarchy-utils';
import { getTypeColor } from '@/lib/colors';

interface HierarchicalWorkItemGridProps {
  items: HierarchicalWorkItem[];
  maxInitialItems?: number;
}

interface HierarchicalGridRowProps {
  item: HierarchicalWorkItem;
  isLast: boolean;
}

function HierarchicalGridRow({ item, isLast }: HierarchicalGridRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const level = item.level || 0;

  return (
    <>
      <tr
        onClick={() => setShowDetail(true)}
        className="border-b border-rh-border hover:bg-rh-border/30 cursor-pointer transition-colors"
      >
        {/* ID with expand/collapse and indentation */}
        <td className="px-3 py-2 text-xs font-mono text-rh-green whitespace-nowrap">
          <div className="flex items-center gap-1" style={{ paddingLeft: `${level * 16}px` }}>
            {hasChildren && level === 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-0.5 hover:bg-rh-border rounded transition-colors flex-shrink-0"
                aria-label={isExpanded ? 'Collapse children' : 'Expand children'}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-rh-text-secondary" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-rh-text-secondary" />
                )}
              </button>
            ) : level > 0 ? (
              <span className="w-3 text-rh-text-secondary text-[10px]">└─</span>
            ) : null}
            <span>{item.id}</span>
          </div>
        </td>

        {/* Type with relation badge */}
        <td className="px-3 py-2">
          <div className="flex flex-col gap-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getTypeColor(item.type)}`}>
              {item.type}
            </span>
            {item.relationType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-rh-border text-rh-text-secondary whitespace-nowrap">
                {item.relationType}
              </span>
            )}
          </div>
        </td>

        {/* State */}
        <td className="px-3 py-2 text-xs text-rh-text whitespace-nowrap">
          {item.state}
        </td>

        {/* Title */}
        <td className="px-3 py-2 text-sm text-rh-text max-w-md">
          <div className="flex items-center gap-2">
            <span className="truncate">{item.title}</span>
            <ExternalLink className="w-3 h-3 text-rh-text-secondary flex-shrink-0" />
          </div>
        </td>

        {/* Priority */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary text-center whitespace-nowrap">
          P{item.priority}
        </td>

        {/* Assigned To */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary truncate max-w-[120px]">
          {item.assignedTo}
        </td>

        {/* Project */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary truncate max-w-[120px]">
          {item.project || 'N/A'}
        </td>

        {/* Area */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary truncate max-w-[150px]">
          {item.areaPath ? item.areaPath.split('\\').pop() : 'N/A'}
        </td>

        {/* Changed Date */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary whitespace-nowrap">
          {item.changedDate ? new Date(item.changedDate).toLocaleDateString() : 'N/A'}
        </td>

        {/* Story Points */}
        <td className="px-3 py-2 text-xs text-yellow-400 text-center whitespace-nowrap">
          {item.storyPoints !== undefined && item.storyPoints !== null ? item.storyPoints : '-'}
        </td>
      </tr>

      {/* Render children rows if expanded */}
      {hasChildren && isExpanded && item.children!.map((child, index) => (
        <HierarchicalGridRow
          key={child.id}
          item={child}
          isLast={index === item.children!.length - 1}
        />
      ))}

      {showDetail && (
        <WorkItemDetailModal
          workItem={item}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}

export default function HierarchicalWorkItemGrid({
  items,
  maxInitialItems = 10,
}: HierarchicalWorkItemGridProps) {
  const [showAll, setShowAll] = useState(false);

  const displayItems = showAll ? items : items.slice(0, maxInitialItems);
  const hasMore = items.length > maxInitialItems;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-rh-border">
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">ID</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">State</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Title</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-rh-text-secondary">Priority</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Assigned</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Project</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Area</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Changed</th>
            <th className="px-3 py-2 text-center text-xs font-medium text-rh-text-secondary">SP</th>
          </tr>
        </thead>
        <tbody>
          {displayItems.map((item, index) => (
            <HierarchicalGridRow
              key={item.id}
              item={item}
              isLast={index === displayItems.length - 1}
            />
          ))}
        </tbody>
      </table>

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
