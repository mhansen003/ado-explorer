'use client';

import { X } from 'lucide-react';
import { ChartData, WorkItem } from '@/types';
import WorkItemChart from './WorkItemChart';

interface ChartModalProps {
  chartData: ChartData;
  workItems: WorkItem[];
  onClose: () => void;
}

export default function ChartModal({ chartData, workItems, onClose }: ChartModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={onClose}>
      <div className="bg-rh-dark border border-rh-border rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rh-border">
          <div>
            <h2 className="text-xl font-semibold text-rh-text">Chart View</h2>
            <p className="text-sm text-rh-text-secondary mt-1">
              {workItems.length} work items visualized
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-rh-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-rh-text-secondary" />
          </button>
        </div>

        {/* Chart Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
          <WorkItemChart chartData={chartData} workItems={workItems} />
        </div>
      </div>
    </div>
  );
}
