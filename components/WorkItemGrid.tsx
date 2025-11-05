'use client';

import { useState } from 'react';
import { WorkItem } from '@/types';
import { ExternalLink } from 'lucide-react';
import WorkItemDetailModal from './WorkItemDetailModal';
import { getTypeColor } from '@/lib/colors';

interface WorkItemGridProps {
  workItem: WorkItem;
}

export default function WorkItemGrid({ workItem }: WorkItemGridProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <tr
        onClick={() => setShowDetail(true)}
        className="border-b border-rh-border hover:bg-rh-border/30 cursor-pointer transition-colors"
      >
        {/* ID */}
        <td className="px-3 py-2 text-xs font-mono text-rh-green whitespace-nowrap">
          {workItem.id}
        </td>

        {/* Type */}
        <td className="px-3 py-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getTypeColor(workItem.type)}`}>
            {workItem.type}
          </span>
        </td>

        {/* State */}
        <td className="px-3 py-2 text-xs text-rh-text whitespace-nowrap">
          {workItem.state}
        </td>

        {/* Title */}
        <td className="px-3 py-2 text-sm text-rh-text max-w-md">
          <div className="flex items-center gap-2">
            <span className="truncate">{workItem.title}</span>
            <ExternalLink className="w-3 h-3 text-rh-text-secondary flex-shrink-0" />
          </div>
        </td>

        {/* Priority */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary text-center whitespace-nowrap">
          P{workItem.priority}
        </td>

        {/* Assigned To */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary truncate max-w-[120px]">
          {workItem.assignedTo}
        </td>

        {/* Area */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary truncate max-w-[150px]">
          {workItem.areaPath ? workItem.areaPath.split('\\').pop() : 'N/A'}
        </td>

        {/* Changed Date */}
        <td className="px-3 py-2 text-xs text-rh-text-secondary whitespace-nowrap">
          {workItem.changedDate ? new Date(workItem.changedDate).toLocaleDateString() : 'N/A'}
        </td>

        {/* Story Points */}
        <td className="px-3 py-2 text-xs text-yellow-400 text-center whitespace-nowrap">
          {workItem.storyPoints !== undefined && workItem.storyPoints !== null ? workItem.storyPoints : '-'}
        </td>
      </tr>

      {showDetail && (
        <WorkItemDetailModal
          workItem={workItem}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
