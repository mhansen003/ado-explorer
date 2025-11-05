'use client';

import { useState, useEffect, useRef } from 'react';
import { CommandTemplate, Placeholder, DynamicSuggestion } from '@/types';
import { ChevronDown, Check } from 'lucide-react';

interface TemplateInputBuilderProps {
  template: CommandTemplate;
  onExecute: (command: string) => void;
  onCancel: () => void;
  // Data sources for dropdowns
  projects: DynamicSuggestion[];
  boards: DynamicSuggestion[];
  users: DynamicSuggestion[];
  states: DynamicSuggestion[];
  types: DynamicSuggestion[];
  tags: DynamicSuggestion[];
  queries: DynamicSuggestion[];
  sprints: DynamicSuggestion[];
}

export default function TemplateInputBuilder({
  template,
  onExecute,
  onCancel,
  projects,
  boards,
  users,
  states,
  types,
  tags,
  queries,
  sprints,
}: TemplateInputBuilderProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [activePlaceholder, setActivePlaceholder] = useState<string | null>(
    template.placeholders.length > 0 ? template.placeholders[0].key : null
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedDropdownIndex, setSelectedDropdownIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get data source for a placeholder type
  const getDataSource = (type: string): DynamicSuggestion[] => {
    switch (type) {
      case 'project': return projects;
      case 'board': return boards;
      case 'user': return users;
      case 'state': return states;
      case 'type': return types;
      case 'tag': return tags;
      case 'query': return queries;
      case 'sprint': return sprints;
      case 'chartType': return [
        { value: 'pie', description: 'Pie chart - circular segments' },
        { value: 'bar', description: 'Bar chart - vertical bars' },
        { value: 'line', description: 'Line chart - connected points' },
        { value: 'area', description: 'Area chart - filled line' },
      ];
      case 'chartDimension': return [
        { value: 'state', description: 'Group by work item state' },
        { value: 'type', description: 'Group by work item type' },
        { value: 'priority', description: 'Group by priority' },
        { value: 'assignedTo', description: 'Group by assigned person' },
        { value: 'createdBy', description: 'Group by creator' },
        { value: 'project', description: 'Group by project' },
        { value: 'areaPath', description: 'Group by area path' },
        { value: 'changedBy', description: 'Group by who last changed' },
        { value: 'iterationPath', description: 'Group by sprint/iteration' },
        { value: 'storyPoints', description: 'Group by story points' },
        { value: 'tags', description: 'Group by tags' },
      ];
      default: return [];
    }
  };

  // Get filtered data source based on filter text
  const getFilteredDataSource = (type: string): DynamicSuggestion[] => {
    const dataSource = getDataSource(type);
    if (!filterText.trim()) return dataSource;

    return dataSource.filter(item =>
      item.value.toLowerCase().includes(filterText.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(filterText.toLowerCase()))
    );
  };

  // Check if all required placeholders are filled
  const isComplete = (): boolean => {
    const requiredPlaceholders = template.placeholders.filter(p => p.required);
    const complete = requiredPlaceholders.every(p => {
      const value = values[p.key];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return !!value;
    });
    console.log('isComplete check:', {
      requiredPlaceholders: requiredPlaceholders.map(p => p.key),
      values,
      complete
    });
    return complete;
  };

  // Handle value selection
  const handleValueSelect = (key: string, value: string, multiSelect: boolean) => {
    if (multiSelect) {
      const currentValues = (values[key] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      setValues(prev => ({ ...prev, [key]: newValues }));
    } else {
      setValues(prev => ({ ...prev, [key]: value }));
      setDropdownOpen(false);
      setFilterText('');
      setSelectedDropdownIndex(0);
      // Move to next placeholder
      const currentIndex = template.placeholders.findIndex(p => p.key === key);
      if (currentIndex < template.placeholders.length - 1) {
        setActivePlaceholder(template.placeholders[currentIndex + 1].key);
      } else {
        setActivePlaceholder(null);
      }
      // Return focus to hidden input so Enter key works
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Handle arrow key navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const placeholder = activePlaceholder ? template.placeholders.find(p => p.key === activePlaceholder) : null;
    const dataSource = placeholder ? getFilteredDataSource(placeholder.type) : [];

    if (dropdownOpen && placeholder && dataSource.length > 0) {
      // Dropdown navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedDropdownIndex(prev =>
          prev < dataSource.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedDropdownIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedItem = dataSource[selectedDropdownIndex];
        if (selectedItem && activePlaceholder) {
          handleValueSelect(activePlaceholder, selectedItem.value, !!placeholder.multiSelect);
        }
      } else if (e.key === ' ' && placeholder.multiSelect) {
        e.preventDefault();
        const selectedItem = dataSource[selectedDropdownIndex];
        if (selectedItem && activePlaceholder) {
          handleValueSelect(activePlaceholder, selectedItem.value, true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDropdownOpen(false);
        setFilterText('');
      }
    } else if (e.key === 'Enter' && isComplete()) {
      // Execute when complete
      e.preventDefault();
      const command = template.buildCommand(values);
      onExecute(command);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // Render a single placeholder as a button/dropdown
  const renderPlaceholder = (placeholder: Placeholder) => {
    const value = values[placeholder.key];
    const isActive = activePlaceholder === placeholder.key;
    const dataSource = getDataSource(placeholder.type); // Use full data source (not filtered) for display lookup
    const filteredDataSource = getFilteredDataSource(placeholder.type); // Get filtered data for dropdown options

    // Helper to get display text for a value
    const getDisplayText = (val: string): string => {
      const item = dataSource.find(item => item.value === val);
      return item?.description || val;
    };

    const displayValue = Array.isArray(value)
      ? value.length > 0
        ? value.length === 1
          ? getDisplayText(value[0])
          : `${value.length} selected`
        : placeholder.label
      : value ? getDisplayText(value) : placeholder.label;

    return (
      <span key={placeholder.key} className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            setActivePlaceholder(placeholder.key);
            setDropdownOpen(true);
            setSelectedDropdownIndex(0);
            setFilterText('');
            setTimeout(() => filterInputRef.current?.focus(), 50);
          }}
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
            isActive
              ? 'bg-rh-green text-rh-dark'
              : value
              ? 'bg-rh-green/20 text-rh-green hover:bg-rh-green/30'
              : 'bg-rh-border text-rh-text-secondary hover:bg-rh-border/60'
          }`}
        >
          {displayValue}
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Dropdown - positioned ABOVE */}
        {isActive && dropdownOpen && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 mb-1 w-96 max-h-80 bg-rh-card border border-rh-border rounded-lg shadow-2xl z-50 flex flex-col"
          >
            {/* Filter Input */}
            <div className="p-2 border-b border-rh-border">
              <input
                ref={filterInputRef}
                type="text"
                value={filterText}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setSelectedDropdownIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type to filter..."
                className="w-full px-3 py-2 bg-rh-dark border border-rh-border rounded text-sm text-rh-text placeholder-rh-text-secondary focus:outline-none focus:border-rh-green"
              />
            </div>

            {/* Options List */}
            <div className="p-2 space-y-1 overflow-y-auto max-h-64">
              {filteredDataSource.length > 0 ? filteredDataSource.map((item, itemIndex) => {
                const isSelected = Array.isArray(value)
                  ? value.includes(item.value)
                  : value === item.value;

                const isHighlighted = selectedDropdownIndex === itemIndex;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleValueSelect(placeholder.key, item.value, !!placeholder.multiSelect)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-rh-green/20 text-rh-green'
                        : isHighlighted
                        ? 'bg-rh-border text-rh-text'
                        : 'hover:bg-rh-border text-rh-text'
                    }`}
                  >
                    {placeholder.multiSelect && (
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-rh-green border-rh-green' : 'border-rh-text-secondary'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-rh-dark" />}
                      </div>
                    )}
                    <span className="flex-1">{item.description || item.value}</span>
                    {item.metadata && (
                      <span className="text-xs text-rh-text-secondary">{item.metadata}</span>
                    )}
                  </button>
                );
              }) : (
                <div className="px-3 py-2 text-sm text-rh-text-secondary text-center">
                  No matches found
                </div>
              )}
            </div>
          </div>
        )}
      </span>
    );
  };

  // Build display text with placeholders
  const buildDisplayText = () => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const regex = /\{(\w+)\}/g;
    let match;

    while ((match = regex.exec(template.displayText)) !== null) {
      // Add text before placeholder
      if (match.index > lastIndex) {
        parts.push(template.displayText.substring(lastIndex, match.index));
      }

      // Add placeholder component
      const placeholderKey = match[1];
      const placeholder = template.placeholders.find(p => p.key === placeholderKey);
      if (placeholder) {
        parts.push(renderPlaceholder(placeholder));
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < template.displayText.length) {
      parts.push(template.displayText.substring(lastIndex));
    }

    return parts;
  };

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (dropdownOpen && dropdownRef.current) {
      const dropdown = dropdownRef.current;
      const selectedButton = dropdown.querySelector(`button:nth-child(${selectedDropdownIndex + 1})`) as HTMLElement;

      if (selectedButton) {
        const dropdownRect = dropdown.getBoundingClientRect();
        const buttonRect = selectedButton.getBoundingClientRect();

        // Check if button is out of view
        if (buttonRect.bottom > dropdownRect.bottom) {
          selectedButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else if (buttonRect.top < dropdownRect.top) {
          selectedButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }, [selectedDropdownIndex, dropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('button') && !target.closest('.absolute')) {
        setDropdownOpen(false);
        setFilterText('');
        // Return focus to hidden input
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  // Focus hidden input when dropdown closes
  useEffect(() => {
    if (!dropdownOpen && !activePlaceholder) {
      // All placeholders filled, focus hidden input for Enter key
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [dropdownOpen, activePlaceholder]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-rh-card border border-rh-green rounded-lg shadow-2xl p-4 z-50">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{template.icon}</span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-rh-text">{template.description}</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-rh-text-secondary hover:text-rh-text"
        >
          Cancel
        </button>
      </div>

      <div className="text-base text-rh-text leading-relaxed flex flex-wrap items-center gap-1 mb-3">
        {buildDisplayText()}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-rh-border">
        <span className="text-xs text-rh-text-secondary">
          {isComplete() ? 'Ready to search!' : 'Fill in all required fields'}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Search button clicked', { isComplete: isComplete(), values });
            if (isComplete()) {
              const command = template.buildCommand(values);
              console.log('Executing command:', command);
              onExecute(command);
            } else {
              console.log('Form not complete', {
                required: template.placeholders.filter(p => p.required),
                values
              });
            }
          }}
          disabled={!isComplete()}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            isComplete()
              ? 'bg-rh-green text-rh-dark hover:bg-rh-green/90 cursor-pointer'
              : 'bg-rh-border text-rh-text-secondary cursor-not-allowed opacity-50'
          }`}
        >
          {isComplete() ? (
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" />
              Search
            </span>
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Hidden input to capture Enter key */}
      <input
        ref={inputRef}
        type="text"
        className="sr-only"
        onKeyDown={handleKeyDown}
        autoFocus
      />
    </div>
  );
}
