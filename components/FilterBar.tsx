'use client';

import { useEffect, useState } from 'react';
import { Filter, X, LayoutGrid, LayoutList, Network, List } from 'lucide-react';
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
  const [authenticatedUser, setAuthenticatedUser] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load all settings from Redis on mount
  useEffect(() => {
    const loadAllSettings = async () => {
      try {
        const response = await fetch('/api/user-settings', { credentials: 'include' });
        const data = await response.json();

        if (data.success && data.settings) {
          // Load filters from Redis if they exist
          if (data.settings.filters) {
            onFiltersChange(data.settings.filters);
          }

          // Load view preferences from Redis if they exist
          if (data.settings.viewPreferences) {
            onViewPreferencesChange(data.settings.viewPreferences);
          }
        }

        setSettingsLoaded(true);
      } catch (error) {
        console.error('Failed to load user settings:', error);
        setSettingsLoaded(true);
      }
    };

    loadAllSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch authenticated user session
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        const data = await response.json();
        if (data.authenticated && data.user?.email) {
          setAuthenticatedUser(data.user.email);
          // Auto-set currentUser if not already set
          if (!filters.currentUser) {
            handleFilterChange('currentUser', data.user.email);
          }
        }
      } catch (error) {
        console.error('Failed to fetch session:', error);
      }
    };

    fetchSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch states when component mounts
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

  const handleFilterChange = async (key: keyof GlobalFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    onFiltersChange(newFilters);
    localStorage.setItem('ado-explorer-filters', JSON.stringify(newFilters));

    // Save to Redis (includes both filters and view preferences)
    if (settingsLoaded) {
      try {
        await fetch('/api/user-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              filters: newFilters,
              viewPreferences,
            },
          }),
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to save filter settings:', error);
      }
    }
  };

  const handleViewPreferenceChange = async (newPrefs: ViewPreferences) => {
    onViewPreferencesChange(newPrefs);
    localStorage.setItem('ado-explorer-view-preferences', JSON.stringify(newPrefs));

    // Save to Redis (includes both filters and view preferences)
    if (settingsLoaded) {
      try {
        await fetch('/api/user-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              filters,
              viewPreferences: newPrefs,
            },
          }),
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to save view preferences:', error);
      }
    }
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
      {/* Edge Tab Button - Positioned near bottom */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-24 right-0 bg-gradient-to-l from-orange-600 to-orange-500 border-l-2 border-t-2 border-b-2 border-orange-400 rounded-l-xl shadow-2xl z-40 py-4 px-3 hover:from-orange-500 hover:to-orange-400 hover:shadow-orange-500/50 transition-all duration-300 group animate-pulse hover:animate-none"
        >
          <div className="flex flex-col items-center gap-1.5">
            <Filter className="w-5 h-5 text-white drop-shadow-lg" />
            {activeFilterCount > 0 && (
              <span className="w-6 h-6 bg-white text-orange-600 rounded-full text-xs flex items-center justify-center font-bold shadow-lg">
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
            {/* Ignore States - Tag Style */}
            <div>
              <div className="text-sm font-medium text-rh-text mb-2">Hide States:</div>
              {loadingStates ? (
                <div className="text-xs text-rh-text-secondary">Loading states...</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {states.map(state => {
                    const isActive = filters.ignoreStates?.includes(state) || false;
                    return (
                      <button
                        key={state}
                        onClick={() => toggleState(state)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-red-500 text-white shadow-lg'
                            : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                        }`}
                      >
                        {state}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-rh-border"></div>

            {/* Quick Filters */}
            <div>
              <div className="text-sm font-medium text-rh-text mb-2">Quick Filters:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const newOnlyMyTickets = !filters.onlyMyTickets;
                    const newFilters = {
                      ...filters,
                      onlyMyTickets: newOnlyMyTickets,
                      // Auto-set currentUser from authenticated session when enabling
                      currentUser: newOnlyMyTickets && authenticatedUser ? authenticatedUser : filters.currentUser
                    };
                    onFiltersChange(newFilters);
                    localStorage.setItem('ado-explorer-filters', JSON.stringify(newFilters));
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filters.onlyMyTickets
                      ? 'bg-rh-green text-rh-dark shadow-lg'
                      : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                  }`}
                >
                  My Tickets Only
                </button>
              </div>

              {filters.onlyMyTickets && authenticatedUser && (
                <div className="mt-2 text-xs text-rh-text-secondary">
                  <span className="opacity-60">Filtering for:</span> <span className="text-rh-green font-medium">{authenticatedUser}</span>
                </div>
              )}
            </div>

            {/* Date Filter */}
            <div>
              <div className="text-sm font-medium text-rh-text mb-2">Date Range:</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (filters.ignoreOlderThanDays === null) {
                      const days = parseInt(daysInput) || 30;
                      handleFilterChange('ignoreOlderThanDays', days);
                    } else {
                      handleFilterChange('ignoreOlderThanDays', null);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filters.ignoreOlderThanDays !== null
                      ? 'bg-rh-green text-rh-dark shadow-lg'
                      : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                  }`}
                >
                  Last {daysInput} Days
                </button>
                {filters.ignoreOlderThanDays !== null && (
                  <input
                    type="number"
                    min="1"
                    value={daysInput}
                    onChange={(e) => handleDaysChange(e.target.value)}
                    className="w-16 px-2 py-1 bg-rh-dark border border-rh-border rounded text-xs text-rh-text focus:outline-none focus:border-rh-green"
                  />
                )}
              </div>
            </div>

            {/* View Options */}
            <div className="pt-2 border-t border-rh-border">
              <div className="text-sm font-medium text-rh-text mb-2">Display Mode:</div>

              {/* Layout Type */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => handleViewPreferenceChange({ ...viewPreferences, useGridView: false })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    !viewPreferences.useGridView
                      ? 'bg-rh-green text-rh-dark shadow-lg'
                      : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                  }`}
                >
                  <LayoutList className="w-3 h-3" />
                  Cards
                </button>
                <button
                  onClick={() => handleViewPreferenceChange({ ...viewPreferences, useGridView: true })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    viewPreferences.useGridView
                      ? 'bg-rh-green text-rh-dark shadow-lg'
                      : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  Grid
                </button>
              </div>

              {/* Hierarchy Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleViewPreferenceChange({ ...viewPreferences, useHierarchyView: false })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    !viewPreferences.useHierarchyView
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                  }`}
                >
                  <List className="w-3 h-3" />
                  Single
                </button>
                <button
                  onClick={() => handleViewPreferenceChange({ ...viewPreferences, useHierarchyView: true })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    viewPreferences.useHierarchyView
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-rh-border/30 text-rh-text-secondary hover:bg-rh-border hover:text-rh-text'
                  }`}
                >
                  <Network className="w-3 h-3" />
                  Hierarchy
                </button>
              </div>
            </div>

            {/* Clear All Filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={async () => {
                  const clearedFilters: GlobalFilters = {
                    ignoreClosed: false,
                    ignoreStates: [],
                    ignoreCreatedBy: [],
                    onlyMyTickets: false,
                    ignoreOlderThanDays: null,
                    currentUser: authenticatedUser || undefined,
                  };
                  onFiltersChange(clearedFilters);
                  localStorage.setItem('ado-explorer-filters', JSON.stringify(clearedFilters));
                  setDaysInput('30');

                  // Save to Redis
                  if (settingsLoaded) {
                    try {
                      await fetch('/api/user-settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          settings: {
                            filters: clearedFilters,
                            viewPreferences,
                          },
                        }),
                        credentials: 'include',
                      });
                    } catch (error) {
                      console.error('Failed to save cleared settings:', error);
                    }
                  }
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
