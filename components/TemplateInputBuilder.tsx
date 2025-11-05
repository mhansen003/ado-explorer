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
}: TemplateInputBuilderProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [activePlaceholder, setActivePlaceholder] = useState<string | null>(
    template.placeholders.length > 0 ? template.placeholders[0].key : null
  );
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get data source for a placeholder type
  const getDataSource = (type: string): DynamicSuggestion[] => {
    switch (type) {
      case 'project': return projects;
      case 'board': return boards;
      case 'user': return users;
      case 'state': return states;
      case 'type': return types;
      case 'tag': return tags;
      default: return [];
    }
  };

  // Check if all required placeholders are filled
  const isComplete = (): boolean => {
    return template.placeholders
      .filter(p => p.required)
      .every(p => {
        const value = values[p.key];
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return !!value;
      });
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
      // Move to next placeholder
      const currentIndex = template.placeholders.findIndex(p => p.key === key);
      if (currentIndex < template.placeholders.length - 1) {
        setActivePlaceholder(template.placeholders[currentIndex + 1].key);
      } else {
        setActivePlaceholder(null);
      }
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isComplete()) {
      const command = template.buildCommand(values);
      onExecute(command);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  // Render a single placeholder as a button/dropdown
  const renderPlaceholder = (placeholder: Placeholder) => {
    const value = values[placeholder.key];
    const isActive = activePlaceholder === placeholder.key;
    const dataSource = getDataSource(placeholder.type);
    const displayValue = Array.isArray(value)
      ? value.length > 0
        ? value.length === 1
          ? value[0]
          : `${value.length} selected`
        : placeholder.label
      : value || placeholder.label;

    return (
      <span key={placeholder.key} className="relative inline-block">
        <button
          type="button"
          onClick={() => {
            setActivePlaceholder(placeholder.key);
            setDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
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

        {/* Dropdown */}
        {isActive && dropdownOpen && dataSource.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-64 max-h-64 overflow-y-auto bg-rh-card border border-rh-border rounded-lg shadow-2xl z-50">
            <div className="p-2 space-y-1">
              {dataSource.map((item) => {
                const isSelected = Array.isArray(value)
                  ? value.includes(item.value)
                  : value === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleValueSelect(placeholder.key, item.value, !!placeholder.multiSelect)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left transition-colors ${
                      isSelected
                        ? 'bg-rh-green/20 text-rh-green'
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
                    <span className="flex-1">{item.value}</span>
                    {item.description && (
                      <span className="text-xs text-rh-text-secondary">{item.description}</span>
                    )}
                  </button>
                );
              })}
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('button') && !target.closest('.absolute')) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

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

      <div className="flex items-center justify-between text-xs text-rh-text-secondary pt-3 border-t border-rh-border">
        <span>Fill in the blanks and press Enter</span>
        {isComplete() ? (
          <span className="flex items-center gap-1 text-rh-green">
            <Check className="w-3 h-3" />
            Ready to search
          </span>
        ) : (
          <span>Required fields missing</span>
        )}
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
