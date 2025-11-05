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
  const [users, setUsers] = useState<Array<{ displayName: string; principalName: string }>>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

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

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        // Ensure we always set an array
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]); // Set empty array on error
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchStates();
    fetchUsers();
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

  const toggleCreatedBy = (user: string) => {
    const currentUsers = Array.isArray(filters.ignoreCreatedBy) ? filters.ignoreCreatedBy : [];
    const newUsers = currentUsers.includes(user)
      ? currentUsers.filter(u => u !== user)
      : [...currentUsers, user];
    handleFilterChange('ignoreCreatedBy', newUsers);
  };

  const activeFilterCount = [
    filters.ignoreClosed,
    filters.onlyMyTickets,
    filters.ignoreOlderThanDays !== null,
    (Array.isArray(filters.ignoreStates) && filters.ignoreStates.length > 0),
    (Array.isArray(filters.ignoreCreatedBy) && filters.ignoreCreatedBy.length > 0),
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
            {/* Ignore States - Multi-select Dropdown */}
            <div className="p-2 hover:bg-rh-border/50 rounded transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-rh-text">Ignore States:</span>
                <div className="relative group flex-1">
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 text-xs bg-rh-dark border border-rh-border rounded hover:border-rh-green text-rh-text text-left flex items-center justify-between"
                  >
                    <span className="truncate">
                      {Array.isArray(filters.ignoreStates) && filters.ignoreStates.length > 0
                        ? `${filters.ignoreStates.length} selected`
                        : 'Select states to ignore'}
                    </span>
                    <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1" />
                  </button>
                  <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-full bg-rh-card border border-rh-border rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                    {loadingStates ? (
                      <div className="px-3 py-2 text-xs text-rh-text-secondary">Loading...</div>
                    ) : (
                      states.map(state => (
                        <button
                          key={state}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleState(state);
                          }}
                          className="w-full px-3 py-2 text-xs text-left hover:bg-rh-border flex items-center justify-between"
                        >
                          <span>{state}</span>
                          {filters.ignoreStates?.includes(state) && <Check className="w-3 h-3 text-rh-green" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {Array.isArray(filters.ignoreStates) && filters.ignoreStates.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {filters.ignoreStates.map(state => (
                    <span
                      key={state}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-rh-green/20 text-rh-green rounded text-xs"
                    >
                      {state}
                      <button
                        onClick={() => toggleState(state)}
                        className="hover:text-rh-text transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Ignore Created By - Multi-select Dropdown */}
            <div className="p-2 hover:bg-rh-border/50 rounded transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-rh-text">Ignore Created By:</span>
                <div className="relative group flex-1">
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 text-xs bg-rh-dark border border-rh-border rounded hover:border-rh-green text-rh-text text-left flex items-center justify-between"
                  >
                    <span className="truncate">
                      {Array.isArray(filters.ignoreCreatedBy) && filters.ignoreCreatedBy.length > 0
                        ? `${filters.ignoreCreatedBy.length} selected`
                        : 'Select users to ignore'}
                    </span>
                    <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1" />
                  </button>
                  <div className="hidden group-hover:block absolute top-full left-0 mt-1 w-full bg-rh-card border border-rh-border rounded-lg shadow-xl z-20 max-h-60 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="px-3 py-2 text-xs text-rh-text-secondary">Loading...</div>
                    ) : (
                      users.map(user => (
                        <button
                          key={user.displayName}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCreatedBy(user.displayName);
                          }}
                          className="w-full px-3 py-2 text-xs text-left hover:bg-rh-border flex items-center justify-between"
                        >
                          <span className="truncate">{user.displayName}</span>
                          {filters.ignoreCreatedBy?.includes(user.displayName) && <Check className="w-3 h-3 text-rh-green" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {Array.isArray(filters.ignoreCreatedBy) && filters.ignoreCreatedBy.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {filters.ignoreCreatedBy.map(user => (
                    <span
                      key={user}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs"
                    >
                      {user}
                      <button
                        onClick={() => toggleCreatedBy(user)}
                        className="hover:text-rh-text transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Legacy Ignore Closed */}
            <label className="flex items-center gap-2 cursor-pointer hover:bg-rh-border/50 p-2 rounded transition-colors">
              <input
                type="checkbox"
                checked={filters.ignoreClosed}
                onChange={(e) => handleFilterChange('ignoreClosed', e.target.checked)}
                className="w-4 h-4 rounded border-rh-border bg-rh-dark text-rh-green focus:ring-rh-green focus:ring-offset-rh-dark"
              />
              <span className="text-sm text-rh-text">Ignore closed tickets (legacy)</span>
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
        )}
      </div>
    </div>
  );
}
