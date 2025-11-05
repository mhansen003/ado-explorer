'use client';

import { useEffect, useState } from 'react';
import { Filter, X, LayoutGrid, LayoutList, ChevronDown, Check } from 'lucide-react';
import { GlobalFilters, ViewPreferences } from '@/types';

interface FilterBarProps {
  filters: GlobalFilters;
  onFiltersChange: (filters: GlobalFilters) => void;
  viewPreferences: ViewPreferences;
  onViewPreferencesChange: (preferences: ViewPreferences) => void;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export default function FilterBar({
  filters,
  onFiltersChange,
  viewPreferences,
  onViewPreferencesChange,
  isExpanded: controlledIsExpanded,
  onExpandedChange
}: FilterBarProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded;
  const setIsExpanded = (value: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(value);
    } else {
      setInternalIsExpanded(value);
    }
  };
  const [daysInput, setDaysInput] = useState(filters.ignoreOlderThanDays?.toString() || '30');
  const [usernameInput, setUsernameInput] = useState(filters.currentUser || '');

  // Fetch states and users when component mounts
  useEffect(() => {
    const fetchStates = async () => {
      setLoadingStates(true);
      try {
        const response = await fetch('/api/states');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        // Ensure we always set an array
        setStates(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch states:', error);
        setStates([]); // Set empty array on error
      } finally {
        setLoadingStates(false);
      }
    };

    fetchStates();
  }, []);

  useEffect(() => {
    // Sync UI inputs with loaded filters
    if (filters.ignoreOlderThanDays) {
      setDaysInput(filters.ignoreOlderThanDays.toString());
    }
    if (filters.currentUser) {
      setUsernameInput(filters.currentUser);
    }
  }, [filters]);

  // Handle Escape key to close drawer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isExpanded, setIsExpanded]);

  const handleFilterChange = (key: keyof GlobalFilters, value: any) => {
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

  const toggleState = (state: string) => {
    const currentStates = Array.isArray(filters.ignoreStates) ? filters.ignoreStates : [];
    const newStates = currentStates.includes(state)
      ? currentStates.filter(s => s !== state)
      : [...currentStates, state];
    handleFilterChange('ignoreStates', newStates);
  };

  const activeFilterCount = [
    filters.ignoreClosed,
    filters.onlyMyTickets,
    filters.ignoreOlderThanDays !== null,
    (Array.isArray(filters.ignoreStates) && filters.ignoreStates.length > 0),
  ].filter(Boolean).length;

  return (
    <>
      {/* Edge Tab Button - Visible when drawer is closed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed top-1/2 right-0 -translate-y-1/2 bg-rh-card border-l border-t border-b border-rh-border rounded-l-lg shadow-lg z-40 py-4 px-2 hover:bg-rh-border transition-colors group"
        >
          <div className="flex flex-col items-center gap-2">
            <Filter className="w-5 h-5 text-rh-green" />
            {activeFilterCount > 0 && (
              <span className="w-6 h-6 bg-rh-green text-rh-dark rounded-full text-xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Backdrop overlay */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Slide-out drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-rh-card border-l border-rh-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
          isExpanded ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-rh-card border-b border-rh-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-rh-green" />
            <h2 className="text-lg font-semibold text-rh-text">Global Filters</h2>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-rh-green text-rh-dark rounded-full text-xs font-medium">
                {activeFilterCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-rh-border rounded transition-colors"
          >
            <X className="w-5 h-5 text-rh-text-secondary" />
          </button>
        </div>

        {/* Filter content */}
        <div className="px-4 py-3 space-y-4">
            {/* Ignore States - Checkbox List */}
            <div>
              <div className="text-sm font-medium text-rh-text mb-3">Ignore States:</div>
              {loadingStates ? (
                <div className="text-xs text-rh-text-secondary">Loading states...</div>
              ) : (
                <div className="space-y-2">
                  {states.map(state => (
                    <label
                      key={state}
                      className="flex items-center gap-2 cursor-pointer hover:bg-rh-border/30 p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={filters.ignoreStates?.includes(state) || false}
                        onChange={() => toggleState(state)}
                        className="w-4 h-4 rounded border-rh-border bg-rh-dark text-rh-green focus:ring-rh-green focus:ring-offset-rh-dark"
                      />
                      <span className="text-sm text-rh-text">{state}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-rh-border"></div>

            {/* Only Show Tickets I Created */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-rh-border/30 p-2 rounded transition-colors">
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
                <span className="text-sm text-rh-text">Only show tickets I created</span>
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
                    ignoreStates: [],
                    ignoreCreatedBy: [],
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
      </div>
    </>
  );
}
