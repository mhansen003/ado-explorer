'use client';

import { WorkItem } from '@/types';
import { X } from 'lucide-react';
import RelationshipDiagram from './RelationshipDiagram';

interface RelationshipModalProps {
  currentWorkItem: WorkItem;
  relatedWorkItems: WorkItem[];
  onClose: () => void;
  onNavigate: (workItem: WorkItem) => void;
}

export default function RelationshipModal({
  currentWorkItem,
  relatedWorkItems,
  onClose,
  onNavigate,
}: RelationshipModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[98vw] h-[98vh] bg-rh-card border border-rh-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-rh-dark/95 backdrop-blur border-b border-rh-border p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-rh-text">
              Relationship Map: #{currentWorkItem.id}
            </h2>
            <p className="text-sm text-rh-text-secondary mt-1">{currentWorkItem.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-rh-border rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-rh-text-secondary" />
          </button>
        </div>

        {/* Diagram */}
        <div className="w-full h-full pt-20">
          <RelationshipDiagram
            currentWorkItem={currentWorkItem}
            relatedWorkItems={relatedWorkItems}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    </div>
  );
}
