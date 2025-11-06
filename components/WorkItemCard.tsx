'use client';

import { useState } from 'react';
import { WorkItem } from '@/types';
import { Calendar, User, AlertCircle, CheckCircle, Clock, Tag, MapPin, Zap, UserPlus } from 'lucide-react';
import WorkItemDetailModal from './WorkItemDetailModal';
import { getTypeColor, getStateColor } from '@/lib/colors';
import { formatDatePST, formatDateTimePST } from '@/lib/date-utils';

interface WorkItemCardProps {
  workItem: WorkItem;
}

const getStateIcon = (state: string) => {
  switch (state.toLowerCase()) {
    case 'active':
    case 'in progress':
      return <Clock className="w-4 h-4" />;
    case 'resolved':
    case 'closed':
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <AlertCircle className="w-4 h-4" />;
  }
};

export default function WorkItemCard({ workItem }: WorkItemCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="w-full bg-rh-card border border-rh-border rounded-lg p-4 hover:border-rh-green transition-all hover:shadow-lg hover:shadow-rh-green/10 text-left"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-rh-green">{workItem.id}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(workItem.type)}`}>
                {workItem.type}
              </span>
              <div className="flex items-center gap-1 text-rh-text-secondary">
                {getStateIcon(workItem.state)}
                <span className="text-xs">{workItem.state}</span>
              </div>
            </div>

            <h3 className="text-sm font-medium text-rh-text mb-2 line-clamp-2">
              {workItem.title}
            </h3>

            {/* Tags */}
            {workItem.tags && workItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {workItem.tags.slice(0, 3).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
                {workItem.tags.length > 3 && (
                  <span className="text-xs text-rh-text-secondary">+{workItem.tags.length - 3}</span>
                )}
              </div>
            )}

            <div className="space-y-1">
              {/* Row 1: Assigned To, Changed Date, Priority */}
              <div className="flex items-center gap-3 text-xs text-rh-text-secondary">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{workItem.assignedTo}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span title={`Last modified: ${formatDateTimePST(workItem.changedDate)}`}>
                    {formatDatePST(workItem.changedDate)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">P{workItem.priority}</span>
                </div>
                {workItem.storyPoints !== undefined && workItem.storyPoints !== null && (
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span className="font-medium text-yellow-400">{workItem.storyPoints}</span>
                  </div>
                )}
              </div>

              {/* Row 2: Area Path and Created By */}
              <div className="flex items-center gap-3 text-xs text-rh-text-secondary">
                {workItem.areaPath && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[150px]" title={workItem.areaPath}>
                      {workItem.areaPath.split('\\').pop()}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <UserPlus className="w-3 h-3" />
                  <span className="truncate max-w-[120px]" title={`Created by: ${workItem.createdBy}`}>
                    {workItem.createdBy}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-rh-text-secondary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>

      {showDetail && (
        <WorkItemDetailModal
          workItem={workItem}
          onClose={() => setShowDetail(false)}
        />
      )}
    </>
  );
}
