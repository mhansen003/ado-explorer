'use client';

import { useEffect, useState } from 'react';
import { Filter, X, LayoutGrid, LayoutList } from 'lucide-react';
import { GlobalFilters, ViewPreferences } from '@/types';

interface FilterBarProps {
  filters: GlobalFilters;
  onFiltersChange: (filters: GlobalFilters) => void;
  viewPreferences: ViewPreferences;
  onViewPreferencesChange: (preferences: ViewPreferences) => void;
}

export default function FilterBar({ filters, onFiltersChange, viewPreferences, onViewPreferencesChange }: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [daysInput, setDaysInput] = useState(filters.ignoreOlderThanDays?.toString() || '30');
  const [usernameInput, setUsernameInput] = useState(filters.currentUser || '');

  useEffect(() => {
    // Load filters from localStorage on mount
    const saved = localStorage.getItem('ado-explorer-filters');
    if (saved) {
      try {
        const savedFilters = JSON.parse(saved);
        onFiltersChange(savedFilters);
        if (savedFilters.ignoreOlderThanDays) {
          setDaysInput(savedFilters.ignoreOlderThanDays.toString());
        }
        if (savedFilters.currentUser) {
          setUsernameInput(savedFilters.currentUser);
        }
      } catch (error) {
        console.error('Failed to load filters from localStorage:', error);
      }
    }

    // Load view preferences from localStorage
    const savedPrefs = localStorage.getItem('ado-explorer-view-preferences');
    if (savedPrefs) {
      try {
        const savedViewPrefs = JSON.parse(savedPrefs);
        onViewPreferencesChange(savedViewPrefs);
      } catch (error) {
        console.error('Failed to load view preferences from localStorage:', error);
      }
    }
  }, []);

  const handleFilterChange = (key: keyof GlobalFilters, value: boolean | number | null) => {
    const newFilters = { ...filters, [key]: value };
    onFiltersChange(newFilters);
    localStorage.setItem('ado-explorer-filters', JSON.stringify(newFilters));
  };

  const handleDaysChange = (value: string) => {
    setDaysInput(value);
    const days = parseInt(value);
    if (!isNaN(days) && days > 0) {
      handleFilterChange('ignoreOlderThanDays', days);
    } else if (value === '') {
      handleFilterChange('ignoreOlderThanDays', null);
    }
  };

  const activeFilterCount = [
    filters.ignoreClosed,
    filters.onlyMyTickets,
    filters.ignoreOlderThanDays !== null,
  ].filter(Boolean).length;

  return (
    <div className="border-b border-rh-border bg-rh-card/50">
      <div className="px-4 py-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm text-rh-text-secondary hover:text-rh-text transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Global Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-rh-green text-rh-dark rounded-full text-xs font-medium">
              {activeFilterCount}
            </span>
          )}
          <span className="text-xs ml-auto">{isExpanded ? '▲' : '▼'}</span>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2 pb-1">
            {/* Ignore Closed */}
            <label className="flex items-center gap-2 cursor-pointer hover:bg-rh-border/50 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={filters.ignoreClosed}
                onChange={(e) => handleFilterChange('ignoreClosed', e.target.checked)}
                className="w-4 h-4 rounded border-rh-border bg-rh-dark text-rh-green focus:ring-rh-green focus:ring-offset-rh-dark"
              />
              <span className="text-sm text-rh-text">Ignore closed tickets</span>
            </label>

            {/* Only My Tickets */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-rh-border/50 p-2 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={filters.onlyMyTickets}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const newFilters = { ...filters, onlyMyTickets: checked };
                    // If unchecking, we keep the username but just disable the filter
                    onFiltersChange(newFilters);
                    localStorage.setItem('ado-explorer-filters', JSON.stringify(newFilters));
                  }}
                  className="w-4 h-4 rounded border-rh-border bg-rh-dark text-rh-green focus:ring-rh-green focus:ring-offset-rh-dark"
                />
                <span className="text-sm text-rh-text">Only show my tickets</span>
              </label>

              {filters.onlyMyTickets && (
                <div className="pl-6 flex items-center gap-2">
                  <span className="text-xs text-rh-text-secondary">Username:</span>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      const newFilters = { ...filters, currentUser: e.target.value };
                      onFiltersChange(newFilters);
                      localStorage.setItem('ado-explorer-filters', JSON.stringify(newFilters));
                    }}
                    className="flex-1 px-2 py-1 bg-rh-dark border border-rh-border rounded text-sm text-rh-text focus:outline-none focus:border-rh-green"
                  />
                </div>
              )}
            </div>

            {/* Ignore Older Than */}
            <div className="flex items-center gap-2 p-2 hover:bg-rh-border/50 rounded transition-colors">
              <input
                type="checkbox"
                checked={filters.ignoreOlderThanDays !== null}
                onChange={(e) => {
                  if (e.target.checked) {
                    const days = parseInt(daysInput) || 30;
                    handleFilterChange('ignoreOlderThanDays', days);
                  } else {
                    handleFilterChange('ignoreOlderThanDays', null);
                  }
                }}
                className="w-4 h-4 rounded border-rh-border bg-rh-dark text-rh-green focus:ring-rh-green focus:ring-offset-rh-dark"
              />
              <span className="text-sm text-rh-text">Ignore older than</span>
              <input
                type="number"
                min="1"
                value={daysInput}
                onChange={(e) => handleDaysChange(e.target.value)}
                disabled={filters.ignoreOlderThanDays === null}
                className="w-16 px-2 py-1 bg-rh-dark border border-rh-border rounded text-sm text-rh-text focus:outline-none focus:border-rh-green disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-rh-text-secondary">days</span>
            </div>

            {/* Grid View Toggle */}
            <div className="pt-2 mt-2 border-t border-rh-border">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-rh-border/50 p-2 rounded transition-colors">
                <input
                  type="checkbox"
                  checked={viewPreferences.useGridView}
                  onChange={(e) => {
                    const newPrefs = { useGridView: e.target.checked };
                    onViewPreferencesChange(newPrefs);
                    localStorage.setItem('ado-explorer-view-preferences', JSON.stringify(newPrefs));
                  }}
                  className="w-4 h-4 rounded border-rh-border bg-rh-dark text-rh-green focus:ring-rh-green focus:ring-offset-rh-dark"
                />
                <div className="flex items-center gap-2">
                  {viewPreferences.useGridView ? (
                    <LayoutGrid className="w-4 h-4 text-rh-green" />
                  ) : (
                    <LayoutList className="w-4 h-4 text-rh-text-secondary" />
                  )}
                  <span className="text-sm text-rh-text">Use grid view (compact table)</span>
                </div>
              </label>
            </div>

            {/* Clear All Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  const clearedFilters: GlobalFilters = {
                    ignoreClosed: false,
                    onlyMyTickets: false,
                    ignoreOlderThanDays: null,
                    currentUser: undefined,
                  };
                  onFiltersChange(clearedFilters);
                  localStorage.setItem('ado-explorer-filters', JSON.stringify(clearedFilters));
                  setDaysInput('30');
                  setUsernameInput('');
                }}
                className="flex items-center gap-1 text-xs text-rh-text-secondary hover:text-rh-green transition-colors mt-2"
              >
                <X className="w-3 h-3" />
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
