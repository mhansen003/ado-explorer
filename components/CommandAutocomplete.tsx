import { Command, DynamicSuggestion } from '@/types';
import { Loader2 } from 'lucide-react';

interface CommandAutocompleteProps {
  commands: Command[];
  dynamicSuggestions?: DynamicSuggestion[];
  isLoadingDynamic?: boolean;
  onSelect: (command: Command) => void;
  onSelectDynamic?: (value: string) => void;
  selectedIndex?: number;
}

export default function CommandAutocomplete({
  commands,
  dynamicSuggestions = [],
  isLoadingDynamic = false,
  onSelect,
  onSelectDynamic,
  selectedIndex = 0
}: CommandAutocompleteProps) {
  const hasCommands = commands.length > 0;
  const hasSuggestions = dynamicSuggestions.length > 0;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-rh-card border border-rh-border rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
      {/* Static Commands */}
      {hasCommands && commands.map((command, index) => (
        <button
          key={command.name}
          onClick={() => onSelect(command)}
          className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-rh-border transition-colors text-left ${
            selectedIndex === index ? 'bg-rh-border' : ''
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
      ))}

      {/* Loading State */}
      {isLoadingDynamic && (
        <div className="px-4 py-3 flex items-center gap-2 text-rh-text-secondary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      )}

      {/* Dynamic Suggestions */}
      {hasSuggestions && dynamicSuggestions.map((suggestion, index) => {
        const itemIndex = commands.length + index;
        return (
          <button
            key={`${suggestion.value}-${index}`}
            onClick={() => onSelectDynamic?.(suggestion.value)}
            className={`w-full px-4 py-3 flex items-start gap-3 hover:bg-rh-border transition-colors text-left border-t border-rh-border/50 ${
              selectedIndex === itemIndex ? 'bg-rh-border' : ''
            }`}
          >

            <span className="text-2xl">✨</span>
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

      {/* No Results */}
      {!hasCommands && !hasSuggestions && !isLoadingDynamic && (
        <div className="px-4 py-3 text-sm text-rh-text-secondary text-center">
          No matches found
        </div>
      )}
    </div>
  );
}
