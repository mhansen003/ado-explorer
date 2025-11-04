'use client';

import { useState } from 'react';
import { WorkItem } from '@/types';
import { Calendar, User, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import WorkItemDetailModal from './WorkItemDetailModal';

interface WorkItemCardProps {
  workItem: WorkItem;
}

const getTypeColor = (type: string) => {
  switch (type.toLowerCase()) {
    case 'bug':
      return 'text-red-400 bg-red-400/10';
    case 'task':
      return 'text-blue-400 bg-blue-400/10';
    case 'user story':
      return 'text-purple-400 bg-purple-400/10';
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
};

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

            <div className="flex items-center gap-4 text-xs text-rh-text-secondary">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>{workItem.assignedTo}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(workItem.createdDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">P{workItem.priority}</span>
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
