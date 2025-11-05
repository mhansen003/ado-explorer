import { Command, DynamicSuggestion, CommandTemplate } from '@/types';
import { Loader2 } from 'lucide-react';

interface CommandAutocompleteProps {
  commands?: Command[];
  templates?: CommandTemplate[];
  dynamicSuggestions?: DynamicSuggestion[];
  isLoadingDynamic?: boolean;
  onSelect?: (command: Command) => void;
  onSelectTemplate?: (template: CommandTemplate) => void;
  onSelectDynamic?: (value: string) => void;
  selectedIndex?: number;
  isMultiSelectMode?: boolean;
  selectedTags?: string[];
}

export default function CommandAutocomplete({
  commands = [],
  templates = [],
  dynamicSuggestions = [],
  isLoadingDynamic = false,
  onSelect,
  onSelectTemplate,
  onSelectDynamic,
  selectedIndex = 0,
  isMultiSelectMode = false,
  selectedTags = []
}: CommandAutocompleteProps) {
  const hasCommands = commands.length > 0;
  const hasTemplates = templates.length > 0;
  const hasSuggestions = dynamicSuggestions.length > 0;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-rh-card border border-rh-border rounded-lg shadow-2xl overflow-hidden max-h-80 overflow-y-auto z-50">
      {/* Templates */}
      {hasTemplates && templates.map((template, index) => (
        <button
          key={template.id}
          onClick={() => onSelectTemplate?.(template)}
          className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-rh-border transition-colors text-left ${
            selectedIndex === index ? 'bg-rh-border' : ''
          }`}
        >
          <span className="text-2xl">{template.icon}</span>
          <div className="flex-1">
            <div className="text-rh-text font-medium mb-1">
              {template.displayText.split(/(\{\w+\})/).map((part, i) => {
                if (part.match(/^\{\w+\}$/)) {
                  return (
                    <span key={i} className="text-rh-green">
                      {part}
                    </span>
                  );
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
            <p className="text-xs text-rh-text-secondary">{template.description}</p>
          </div>
        </button>
      ))}

      {/* Tab hint for commands with parameters */}
      {hasCommands && commands.some(cmd => cmd.hasParam) && !hasSuggestions && (
        <div className="px-4 py-2 bg-rh-border/30 border-b border-rh-border text-xs text-rh-text-secondary flex items-center gap-2">
          <span className="px-2 py-0.5 bg-rh-dark rounded border border-rh-border font-mono">Tab</span>
          <span>Press Tab after typing a command to see all options</span>
        </div>
      )}

      {/* Static Commands (Legacy) */}
      {hasCommands && commands.map((command, index) => {
        const itemIndex = templates.length + index;
        return (
          <button
            key={command.name}
            onClick={() => onSelect?.(command)}
            className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-rh-border transition-colors text-left ${
              selectedIndex === itemIndex ? 'bg-rh-border' : ''
            }`}
          >
            <span className="text-2xl">{command.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-rh-green font-medium">/{command.name}</span>
                {command.hasParam && (
                  <span className="text-xs text-rh-text-secondary">&lt;parameter&gt;</span>
                )}
                {command.isDynamic && (
                  <span className="text-xs px-2 py-0.5 bg-rh-green/10 text-rh-green rounded">dynamic</span>
                )}
              </div>
              <p className="text-sm text-rh-text-secondary mt-0.5">{command.description}</p>
            </div>
          </button>
        );
      })}

      {/* Loading State */}
      {isLoadingDynamic && (
        <div className="px-4 py-3 flex items-center gap-2 text-rh-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      )}

      {/* Dynamic Suggestions */}
      {hasSuggestions && (
        <>
          {!hasCommands && !hasTemplates && (
            <div className="px-4 py-2 bg-rh-border/30 border-b border-rh-border text-xs text-rh-text-secondary flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-rh-green">✓</span>
                <span>{dynamicSuggestions.length} option{dynamicSuggestions.length !== 1 ? 's' : ''} available</span>
                {isMultiSelectMode && selectedTags.length > 0 && (
                  <span className="text-rh-green font-medium">({selectedTags.length} selected)</span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <span className="px-1.5 py-0.5 bg-rh-dark rounded border border-rh-border font-mono text-xs">↑</span>
                <span className="px-1.5 py-0.5 bg-rh-dark rounded border border-rh-border font-mono text-xs">↓</span>
                {isMultiSelectMode && (
                  <>
                    <span className="px-1.5 py-0.5 bg-rh-dark rounded border border-rh-border font-mono text-xs ml-1">Space</span>
                    <span>to select</span>
                  </>
                )}
                {!isMultiSelectMode && <span className="ml-1">to navigate</span>}
              </span>
            </div>
          )}
          {dynamicSuggestions.map((suggestion, index) => {
            const itemIndex = templates.length + commands.length + index;
            const isSelected = isMultiSelectMode && selectedTags.includes(suggestion.value);
            return (
              <button
                key={`${suggestion.value}-${index}`}
                onClick={() => onSelectDynamic?.(suggestion.value)}
                className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-rh-border transition-colors text-left border-t border-rh-border/50 ${
                  selectedIndex === itemIndex ? 'bg-rh-border' : ''
                }`}
              >
                {isMultiSelectMode ? (
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                    isSelected ? 'bg-rh-green border-rh-green' : 'border-rh-text-secondary'
                  }`}>
                    {isSelected && <span className="text-rh-dark text-sm">✓</span>}
                  </div>
                ) : (
                  <span className="text-2xl">✨</span>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-rh-text font-medium">{suggestion.value}</span>
                  </div>
                  {suggestion.description && (
                    <p className="text-xs text-rh-text-secondary mt-0.5">{suggestion.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </>
      )}

      {/* No Results */}
      {!hasCommands && !hasTemplates && !hasSuggestions && !isLoadingDynamic && (
        <div className="px-4 py-3 text-sm text-rh-text-secondary text-center">
          No matches found
        </div>
      )}
    </div>
  );
}
