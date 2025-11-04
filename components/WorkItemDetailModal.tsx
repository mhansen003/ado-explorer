'use client';

import { WorkItem } from '@/types';
import { X, User, Calendar, AlertCircle, Tag, ExternalLink } from 'lucide-react';

interface WorkItemDetailModalProps {
  workItem: WorkItem;
  onClose: () => void;
}

export default function WorkItemDetailModal({ workItem, onClose }: WorkItemDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-rh-card border border-rh-border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-rh-border">
          <div className="flex items-center gap-3">
            <span className="text-lg font-mono text-rh-green">{workItem.id}</span>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-rh-green/10 text-rh-green">
              {workItem.type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-rh-border rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-rh-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          <h2 className="text-2xl font-semibold text-rh-text mb-6">
            {workItem.title}
          </h2>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">State:</span>
                <span className="text-rh-text font-medium">{workItem.state}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Assigned to:</span>
                <span className="text-rh-text font-medium">{workItem.assignedTo}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Created by:</span>
                <span className="text-rh-text font-medium">{workItem.createdBy}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Created:</span>
                <span className="text-rh-text font-medium">
                  {new Date(workItem.createdDate).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Tag className="w-4 h-4 text-rh-text-secondary" />
                <span className="text-rh-text-secondary">Priority:</span>
                <span className="text-rh-text font-medium">P{workItem.priority}</span>
              </div>

              {workItem.project && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-rh-text-secondary">Project:</span>
                  <span className="text-rh-text font-medium">{workItem.project}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-rh-text mb-2">Description</h3>
            <div className="bg-rh-dark border border-rh-border rounded-lg p-4 text-sm text-rh-text-secondary">
              {workItem.description || 'No description available.'}
            </div>
          </div>

          {/* Tags */}
          {workItem.tags && workItem.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-rh-text mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {workItem.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-rh-dark border border-rh-border rounded-full text-xs text-rh-text"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-rh-border">
            <button className="flex items-center gap-2 px-4 py-2 bg-rh-green text-rh-dark rounded-lg font-medium hover:bg-green-600 transition-colors">
              <ExternalLink className="w-4 h-4" />
              Open in Azure DevOps
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-rh-dark border border-rh-border text-rh-text rounded-lg font-medium hover:bg-rh-border transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
