import { Command } from '@/types';

interface CommandAutocompleteProps {
  commands: Command[];
  onSelect: (command: Command) => void;
}

export default function CommandAutocomplete({ commands, onSelect }: CommandAutocompleteProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-rh-card border border-rh-border rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
      {commands.map((command) => (
        <button
          key={command.name}
          onClick={() => onSelect(command)}
          className="w-full px-4 py-3 flex items-start gap-3 hover:bg-rh-border transition-colors text-left"
        >
          <span className="text-2xl">{command.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-rh-green font-medium">/{command.name}</span>
              {command.hasParam && (
                <span className="text-xs text-rh-text-secondary">&lt;parameter&gt;</span>
              )}
            </div>
            <p className="text-sm text-rh-text-secondary mt-0.5">{command.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
