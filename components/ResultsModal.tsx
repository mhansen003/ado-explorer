'use client';

import { Message } from '@/types';
import { X, Download } from 'lucide-react';
import { useState } from 'react';
import WorkItemDetailModal from './WorkItemDetailModal';
import { getTypeColor, getStateColor } from '@/lib/colors';

interface ResultsModalProps {
  message: Message;
  onClose: () => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
}

export default function ResultsModal({ message, onClose, onExportCSV, onExportJSON }: ResultsModalProps) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedStates, setSelectedStates] = useState<Set<string>>(new Set());

  if (!message.workItems) return null;

  const workItems = message.workItems;
  const typeCounts = workItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stateCounts = workItems.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter work items based on selected types and states
  const filteredWorkItems = workItems.filter(item => {
    const typeMatch = selectedTypes.size === 0 || selectedTypes.has(item.type);
    const stateMatch = selectedStates.size === 0 || selectedStates.has(item.state);
    return typeMatch && stateMatch;
  });

  // Toggle functions for filters
  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const toggleState = (state: string) => {
    setSelectedStates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(state)) {
        newSet.delete(state);
      } else {
        newSet.add(state);
      }
      return newSet;
    });
  };

  const clearAllFilters = () => {
    setSelectedTypes(new Set());
    setSelectedStates(new Set());
  };

  const hasActiveFilters = selectedTypes.size > 0 || selectedStates.size > 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
        <div className="bg-rh-card border border-rh-border rounded-xl max-w-7xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-rh-border">
            <div>
              <h2 className="text-xl font-semibold text-rh-text">All Results</h2>
              <p className="text-sm text-rh-text-secondary mt-1">
                {hasActiveFilters ? (
                  <>
                    Showing {filteredWorkItems.length} of {workItems.length} work items
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="ml-2 text-rh-green hover:text-rh-green/80 underline"
                      >
                        (clear filters)
                      </button>
                    )}
                  </>
                ) : (
                  `${workItems.length} work items`
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onExportCSV}
                className="flex items-center gap-2 px-3 py-2 bg-rh-dark border border-rh-border rounded-lg text-sm hover:border-rh-green transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={onExportJSON}
                className="flex items-center gap-2 px-3 py-2 bg-rh-dark border border-rh-border rounded-lg text-sm hover:border-rh-green transition-colors"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-rh-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-rh-text-secondary" />
              </button>
            </div>
          </div>

          {/* Summary Stats - Interactive Filters */}
          <div className="px-6 py-4 bg-rh-dark border-b border-rh-border">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-rh-text-secondary mb-2">
                  Filter by Type:
                  <span className="ml-2 text-rh-text font-medium">
                    {selectedTypes.size > 0 ? `${selectedTypes.size} selected` : 'Click to filter'}
                  </span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(typeCounts).map(([type, count]) => {
                    const isActive = selectedTypes.has(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-all ${
                          isActive
                            ? `${getTypeColor(type)} ring-2 ring-rh-green ring-offset-2 ring-offset-rh-dark shadow-lg`
                            : `${getTypeColor(type)} opacity-50 hover:opacity-100`
                        }`}
                      >
                        {type}: {count}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs text-rh-text-secondary mb-2">
                  Filter by State:
                  <span className="ml-2 text-rh-text font-medium">
                    {selectedStates.size > 0 ? `${selectedStates.size} selected` : 'Click to filter'}
                  </span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(stateCounts).map(([state, count]) => {
                    const isActive = selectedStates.has(state);
                    return (
                      <button
                        key={state}
                        onClick={() => toggleState(state)}
                        className={`text-xs px-3 py-1.5 rounded-full bg-rh-card border transition-all ${
                          isActive
                            ? `border-rh-green ${getStateColor(state)} ring-2 ring-rh-green ring-offset-2 ring-offset-rh-dark shadow-lg`
                            : `border-rh-border ${getStateColor(state)} opacity-50 hover:opacity-100`
                        }`}
                      >
                        {state}: {count}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-[calc(90vh-240px)]">
            <table className="w-full">
              <thead className="bg-rh-dark sticky top-0 z-10">
                <tr className="border-b border-rh-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-rh-text-secondary">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkItems.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`border-b border-rh-border hover:bg-rh-border cursor-pointer transition-colors ${
                      index % 2 === 0 ? 'bg-rh-card' : 'bg-rh-dark'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-rh-green">{item.id}</td>
                    <td className="px-4 py-3 text-sm text-rh-text max-w-md truncate">{item.title}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(item.type)}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${getStateColor(item.state)}`}>
                        {item.state}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-rh-text">P{item.priority}</td>
                    <td className="px-4 py-3 text-sm text-rh-text truncate max-w-xs">{item.assignedTo}</td>
                    <td className="px-4 py-3 text-sm text-rh-text-secondary">
                      {new Date(item.createdDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Work Item Detail Modal */}
      {selectedItem && (
        <WorkItemDetailModal
          workItem={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
