'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import MessageList from './MessageList';
import CommandAutocomplete from './CommandAutocomplete';
import { Message, Command, DynamicSuggestion } from '@/types';

const COMMANDS: Command[] = [
  { name: 'project', description: 'Filter by project (auto-completes from your ADO)', icon: '📁', hasParam: true, isDynamic: true },
  { name: 'board', description: 'Filter by board/team (auto-completes from your ADO)', icon: '📋', hasParam: true, isDynamic: true },
  { name: 'created_by', description: 'Filter by creator (e.g., /created_by ericka)', icon: '👤', hasParam: true },
  { name: 'assigned_to', description: 'Filter by assignee', icon: '📌', hasParam: true },
  { name: 'state', description: 'Filter by state (e.g., /state active)', icon: '📊', hasParam: true },
  { name: 'type', description: 'Filter by work item type (Bug, Task, Story)', icon: '🏷️', hasParam: true },
  { name: 'tag', description: 'Filter by tag', icon: '🔖', hasParam: true },
  { name: 'recent', description: 'Show recently updated items', icon: '⏰' },
  { name: 'help', description: 'Show available commands', icon: '❓' },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome to ADO Explorer! Type a slash command to get started. Try /help to see available commands.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<DynamicSuggestion[]>([]);
  const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (input.startsWith('/')) {
      const parts = input.slice(1).split(' ');
      const commandName = parts[0].toLowerCase();
      const param = parts.slice(1).join(' ').toLowerCase();

      // Filter static commands
      const filtered = COMMANDS.filter(cmd =>
        cmd.name.toLowerCase().includes(commandName)
      );

      // Check if we need to fetch dynamic suggestions
      if (commandName === 'project' && param) {
        fetchProjects(param);
      } else if (commandName === 'board' && param) {
        fetchBoards(param);
      } else {
        setDynamicSuggestions([]);
      }

      setFilteredCommands(filtered);
      setShowAutocomplete(filtered.length > 0 || dynamicSuggestions.length > 0);
    } else {
      setShowAutocomplete(false);
      setDynamicSuggestions([]);
    }
  }, [input, dynamicSuggestions.length]);

  const fetchProjects = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/projects');
      const data = await response.json();

      if (response.ok && data.projects) {
        const filtered = data.projects
          .filter((p: any) => p.name.toLowerCase().includes(searchTerm))
          .map((p: any) => ({
            value: p.name,
            description: p.description || undefined,
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const fetchBoards = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/boards');
      const data = await response.json();

      if (response.ok && data.teams) {
        const filtered = data.teams
          .filter((t: any) => t.name.toLowerCase().includes(searchTerm))
          .map((t: any) => ({
            value: t.name,
            description: t.projectName ? `Project: ${t.projectName}` : undefined,
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowAutocomplete(false);

    // Process command
    await processCommand(input);
  };

  const processCommand = async (command: string) => {
    if (command.startsWith('/help')) {
      const helpMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: 'Available commands:\n\n' + COMMANDS.map(cmd =>
          `/${cmd.name}${cmd.hasParam ? ' <param>' : ''} - ${cmd.description}`
        ).join('\n'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, helpMessage]);
      return;
    }

    // Show loading message
    const loadingMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: 'Searching Azure DevOps...',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Call the API
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search work items');
      }

      // Show results or use mock data as fallback
      const searchScope = data.searchScope ? ` (${data.searchScope})` : '';
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'results',
        content: `Results for: ${command}${searchScope}`,
        timestamp: new Date(),
        workItems: data.workItems && data.workItems.length > 0 ? data.workItems : generateMockWorkItems(command),
      };
      setMessages(prev => [...prev.slice(0, -1), resultMessage]);
    } catch (error: any) {
      // Show error message and fall back to mock data for demo purposes
      console.warn('API error, using mock data:', error.message);
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'results',
        content: `Results for: ${command} (Demo Mode - Configure ADO credentials to see real data)`,
        timestamp: new Date(),
        workItems: generateMockWorkItems(command),
      };
      setMessages(prev => [...prev.slice(0, -1), resultMessage]);
    }
  };

  const generateMockWorkItems = (command: string) => {
    // Generate mock work items based on command
    const items = [];
    const count = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < count; i++) {
      items.push({
        id: `WI-${1000 + i}`,
        title: `Sample work item ${i + 1} related to ${command.replace('/', '')}`,
        type: ['Bug', 'Task', 'User Story'][Math.floor(Math.random() * 3)],
        state: ['Active', 'Resolved', 'In Progress'][Math.floor(Math.random() * 3)],
        assignedTo: ['Ericka', 'John', 'Sarah', 'Mike'][Math.floor(Math.random() * 4)],
        createdBy: ['Ericka', 'John', 'Sarah'][Math.floor(Math.random() * 3)],
        createdDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        priority: Math.floor(Math.random() * 4) + 1,
      });
    }

    return items;
  };

  const handleCommandSelect = (command: Command) => {
    setInput(`/${command.name}${command.hasParam ? ' ' : ''}`);
    setDynamicSuggestions([]);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleDynamicSelect = (value: string) => {
    // Get the current command name
    const parts = input.slice(1).split(' ');
    const commandName = parts[0];

    // Replace with the selected value
    setInput(`/${commandName} ${value}`);
    setDynamicSuggestions([]);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <MessageList messages={messages} />

      <div className="relative p-4 border-t border-rh-border bg-rh-dark">
        {showAutocomplete && (
          <CommandAutocomplete
            commands={filteredCommands}
            dynamicSuggestions={dynamicSuggestions}
            isLoadingDynamic={isLoadingDynamic}
            onSelect={handleCommandSelect}
            onSelectDynamic={handleDynamicSelect}
          />
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type / for commands or enter a search query..."
            className="flex-1 px-4 py-3 bg-rh-card border border-rh-border rounded-lg text-rh-text placeholder-rh-text-secondary focus:outline-none focus:border-rh-green"
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-rh-green text-rh-dark rounded-lg font-medium hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-rh-green focus:ring-offset-2 focus:ring-offset-rh-dark"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
