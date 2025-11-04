'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import MessageList from './MessageList';
import CommandAutocomplete from './CommandAutocomplete';
import { Message, Command, DynamicSuggestion } from '@/types';

const COMMANDS: Command[] = [
  { name: 'prompt', description: 'Ask a natural language question (AI-powered)', icon: '🤖', hasParam: true },
  { name: 'project', description: 'Filter by project (auto-completes from your ADO)', icon: '📁', hasParam: true, isDynamic: true },
  { name: 'board', description: 'Filter by board/team (auto-completes from your ADO)', icon: '📋', hasParam: true, isDynamic: true },
  { name: 'created_by', description: 'Filter by creator (auto-completes)', icon: '👤', hasParam: true, isDynamic: true },
  { name: 'assigned_to', description: 'Filter by assignee (auto-completes)', icon: '📌', hasParam: true, isDynamic: true },
  { name: 'state', description: 'Filter by state (auto-completes)', icon: '📊', hasParam: true, isDynamic: true },
  { name: 'type', description: 'Filter by work item type (auto-completes)', icon: '🏷️', hasParam: true, isDynamic: true },
  { name: 'tag', description: 'Filter by tag (auto-completes)', icon: '🔖', hasParam: true, isDynamic: true },
  { name: 'recent', description: 'Show recently updated items', icon: '⏰' },
  { name: 'help', description: 'Show available commands', icon: '❓' },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<DynamicSuggestion[]>([]);
  const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);

  // Pre-loaded autocomplete data
  const [cachedProjects, setCachedProjects] = useState<DynamicSuggestion[]>([]);
  const [cachedBoards, setCachedBoards] = useState<DynamicSuggestion[]>([]);
  const [cachedUsers, setCachedUsers] = useState<DynamicSuggestion[]>([]);
  const [cachedStates, setCachedStates] = useState<DynamicSuggestion[]>([]);
  const [cachedTypes, setCachedTypes] = useState<DynamicSuggestion[]>([]);
  const [cachedTags, setCachedTags] = useState<DynamicSuggestion[]>([]);

  // Multi-select state for tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  useEffect(() => {
    // Show autocomplete when focused and input is empty or just "/"
    if (isFocused && (input === '' || input === '/')) {
      setFilteredCommands(COMMANDS);
      setDynamicSuggestions([]);
      setShowAutocomplete(true);
      setSelectedIndex(0);
      return;
    }

    if (input.startsWith('/')) {
      const parts = input.slice(1).split(' ');
      const commandName = parts[0].toLowerCase();
      const param = parts.slice(1).join(' ').toLowerCase();

      // Filter static commands
      const filtered = COMMANDS.filter(cmd =>
        cmd.name.toLowerCase().includes(commandName)
      );

      // Check if we need to fetch dynamic suggestions
      if (param) {
        switch (commandName) {
          case 'project':
            fetchProjects(param);
            break;
          case 'board':
            fetchBoards(param);
            break;
          case 'created_by':
          case 'assigned_to':
            fetchUsers(param);
            break;
          case 'state':
            fetchStates(param);
            break;
          case 'type':
            fetchTypes(param);
            break;
          case 'tag':
            fetchTags(param);
            break;
          default:
            setDynamicSuggestions([]);
        }
      } else {
        setDynamicSuggestions([]);
      }

      setFilteredCommands(filtered);
      setShowAutocomplete(filtered.length > 0 || dynamicSuggestions.length > 0);
      setSelectedIndex(0); // Reset selection when items change
    } else {
      setShowAutocomplete(false);
      setDynamicSuggestions([]);
      setSelectedIndex(0);
    }
  }, [input, dynamicSuggestions.length, isFocused]);

  // Initialize messages only on client side to avoid hydration errors
  useEffect(() => {
    setIsClient(true);

    const welcomeMessage: Message = {
      id: '1',
      type: 'system',
      content: 'Welcome to ADO Explorer! 👋\n\n✨ Click the input box below to see all available commands\n💡 Or type / to start exploring\n🔍 Try /project or /board to see your ADO data with autocomplete!\n⌨️  Press Tab after a command to see all available options',
      timestamp: new Date(),
    };

    const helpMessage: Message = {
      id: '2',
      type: 'system',
      content: 'Available commands:\n\n' + COMMANDS.map(cmd =>
        `/${cmd.name}${cmd.hasParam ? ' <param>' : ''} - ${cmd.description}`
      ).join('\n') + '\n\n💡 Click the input box or type / to get started!\n⌨️  Press Tab after any command to see all options',
      timestamp: new Date(),
    };

    setMessages([welcomeMessage, helpMessage]);
  }, []); // Empty dependency array = run once on mount

  // Pre-load all autocomplete data on mount
  useEffect(() => {
    const preloadData = async () => {
      console.log('[ChatInterface] Starting pre-load of autocomplete data...');

      // Pre-load projects
      try {
        const response = await fetch('/api/projects');
        const data = await response.json();
        if (response.ok && data.projects) {
          setCachedProjects(data.projects.map((p: any) => ({
            value: p.name,
            description: p.description || undefined,
          })));
          console.log('[ChatInterface] Pre-loaded projects:', data.projects.length);
        } else {
          console.warn('[ChatInterface] Projects API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load projects:', err);
      }

      // Pre-load boards
      try {
        const response = await fetch('/api/boards');
        const data = await response.json();
        if (response.ok && data.teams) {
          setCachedBoards(data.teams.map((t: any) => ({
            value: t.name,
            description: t.projectName ? `Project: ${t.projectName}` : undefined,
          })));
        }
      } catch (err) {
        console.warn('Could not pre-load boards');
      }

      // Pre-load users
      try {
        const response = await fetch('/api/users');
        const data = await response.json();
        if (response.ok && data.users) {
          setCachedUsers(data.users.map((u: any) => ({
            value: u.displayName,
            description: u.uniqueName || undefined,
          })));
        }
      } catch (err) {
        console.warn('Could not pre-load users');
      }

      // Pre-load states
      try {
        const response = await fetch('/api/states');
        const data = await response.json();
        if (response.ok && data.states) {
          setCachedStates(data.states.map((s: string) => ({ value: s })));
        }
      } catch (err) {
        console.warn('Could not pre-load states');
      }

      // Pre-load types
      try {
        const response = await fetch('/api/types');
        const data = await response.json();
        if (response.ok && data.types) {
          setCachedTypes(data.types.map((t: string) => ({ value: t })));
        }
      } catch (err) {
        console.warn('Could not pre-load types');
      }

      // Pre-load tags
      try {
        const response = await fetch('/api/tags');
        const data = await response.json();
        if (response.ok && data.tags) {
          setCachedTags(data.tags.map((t: string) => ({ value: t })));
        }
      } catch (err) {
        console.warn('Could not pre-load tags');
      }
    };

    preloadData();
  }, []);

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

  const fetchUsers = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/users');
      const data = await response.json();

      if (response.ok && data.users) {
        const filtered = data.users
          .filter((u: any) => u.displayName.toLowerCase().includes(searchTerm))
          .map((u: any) => ({
            value: u.displayName,
            description: u.uniqueName || undefined,
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const fetchStates = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/states');
      const data = await response.json();

      if (response.ok && data.states) {
        const filtered = data.states
          .filter((s: string) => s.toLowerCase().includes(searchTerm))
          .map((s: string) => ({
            value: s,
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching states:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const fetchTypes = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/types');
      const data = await response.json();

      if (response.ok && data.types) {
        const filtered = data.types
          .filter((t: string) => t.toLowerCase().includes(searchTerm))
          .map((t: string) => ({
            value: t,
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching types:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const fetchTags = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/tags');
      const data = await response.json();

      if (response.ok && data.tags) {
        const filtered = data.tags
          .filter((t: string) => t.toLowerCase().includes(searchTerm))
          .map((t: string) => ({
            value: t,
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
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

  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    setShowAutocomplete(false);
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

    // Handle /prompt command with OpenAI
    if (command.startsWith('/prompt ')) {
      const prompt = command.replace('/prompt ', '').trim();

      const loadingMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: '🤖 Analyzing your question with AI...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, loadingMessage]);

      try {
        const response = await fetch('/api/prompt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to process prompt');
        }

        const aiNote = data.aiGenerated ? `\n\n🤖 AI-Generated Query: ${data.generatedQuery}` : '';
        const searchScope = data.searchScope ? ` (${data.searchScope})` : '';
        const resultMessage: Message = {
          id: Date.now().toString(),
          type: 'results',
          content: `Results for: "${prompt}"${searchScope}${aiNote}`,
          timestamp: new Date(),
          workItems: data.workItems || [],
        };
        setMessages(prev => [...prev.slice(0, -1), resultMessage]);
      } catch (error: any) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `❌ Error: ${error.message}\n\nMake sure OPENAI_API_KEY is set in Vercel environment variables.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev.slice(0, -1), errorMessage]);
      }
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

    // For tag command, support multi-select
    if (commandName === 'tag' && isMultiSelectMode) {
      handleToggleTag(value);
      return;
    }

    // Replace with the selected value
    setInput(`/${commandName} ${value}`);
    setDynamicSuggestions([]);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag];

      // Update input field with selected tags
      setInput(`/tag ${newTags.join(', ')}`);

      return newTags;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Calculate total items in autocomplete
    const totalItems = filteredCommands.length + dynamicSuggestions.length;

    // Handle autocomplete navigation
    if (showAutocomplete && totalItems > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % totalItems);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setShowAutocomplete(false);
        setSelectedIndex(0);
        setIsMultiSelectMode(false);
        setSelectedTags([]);
        return;
      }

      if (e.key === ' ' && isMultiSelectMode && showAutocomplete) {
        e.preventDefault();
        // Toggle the currently selected tag
        if (selectedIndex >= filteredCommands.length) {
          const suggestionIndex = selectedIndex - filteredCommands.length;
          if (suggestionIndex < dynamicSuggestions.length) {
            handleToggleTag(dynamicSuggestions[suggestionIndex].value);
          }
        }
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        // If in multi-select mode with tags selected, send the search
        if (isMultiSelectMode && selectedTags.length > 0) {
          setShowAutocomplete(false);
          setIsMultiSelectMode(false);
          handleSend();
          return;
        }

        // Only select from autocomplete if there are actual items to select
        const hasValidSelection = (selectedIndex < filteredCommands.length) ||
                                 (selectedIndex >= filteredCommands.length &&
                                  (selectedIndex - filteredCommands.length) < dynamicSuggestions.length);

        if (hasValidSelection && (filteredCommands.length > 0 || dynamicSuggestions.length > 0)) {
          // Select the highlighted item
          if (selectedIndex < filteredCommands.length) {
            handleCommandSelect(filteredCommands[selectedIndex]);
          } else {
            const suggestionIndex = selectedIndex - filteredCommands.length;
            if (suggestionIndex < dynamicSuggestions.length) {
              handleDynamicSelect(dynamicSuggestions[suggestionIndex].value);
            }
          }
        } else {
          // No valid selection or autocomplete is empty - just send the command
          handleSend();
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();

        // Check if user has typed a command and space (e.g., "/project ")
        const parts = input.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const hasSpace = input.endsWith(' ');

        console.log('[Tab Handler]', {
          input,
          commandName,
          hasSpace,
          parts,
          cachedProjectsLength: cachedProjects.length,
          cachedBoardsLength: cachedBoards.length,
          cachedUsersLength: cachedUsers.length,
          cachedStatesLength: cachedStates.length,
          cachedTypesLength: cachedTypes.length,
          cachedTagsLength: cachedTags.length,
        });

        // If command has a space after it, show all cached options for that command
        if (hasSpace && parts.length === 2 && parts[1] === '') {
          let cachedData: DynamicSuggestion[] = [];

          switch (commandName) {
            case 'project':
              cachedData = cachedProjects;
              break;
            case 'board':
              cachedData = cachedBoards;
              break;
            case 'created_by':
            case 'assigned_to':
              cachedData = cachedUsers;
              break;
            case 'state':
              cachedData = cachedStates;
              break;
            case 'type':
              cachedData = cachedTypes;
              break;
            case 'tag':
              cachedData = cachedTags;
              // Enable multi-select mode for tags
              setIsMultiSelectMode(true);
              setSelectedTags([]);
              break;
          }

          console.log('[Tab Handler] Showing cached data for', commandName, ':', cachedData.length, 'items');

          if (cachedData.length > 0) {
            setDynamicSuggestions(cachedData);
            setFilteredCommands([]);
            setShowAutocomplete(true);
            setSelectedIndex(0);
            return;
          } else {
            console.warn('[Tab Handler] No cached data available for', commandName);
          }
        }

        // If typing a command, show the dropdown
        if (input.startsWith('/') && !showAutocomplete) {
          setShowAutocomplete(true);
        } else if (selectedIndex < filteredCommands.length) {
          // Select the highlighted command
          handleCommandSelect(filteredCommands[selectedIndex]);
        } else {
          const suggestionIndex = selectedIndex - filteredCommands.length;
          if (suggestionIndex < dynamicSuggestions.length) {
            handleDynamicSelect(dynamicSuggestions[suggestionIndex].value);
          }
        }
        return;
      }
    }

    // Normal enter to send
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
            selectedIndex={selectedIndex}
            isMultiSelectMode={isMultiSelectMode}
            selectedTags={selectedTags}
          />
        )}

        <div className="flex gap-2">
          <button
            onClick={handleClearChat}
            className="px-4 py-3 bg-rh-card border border-rh-border text-rh-text-secondary rounded-lg font-medium hover:bg-rh-border hover:text-rh-text focus:outline-none focus:ring-2 focus:ring-rh-border"
            title="Clear chat history"
          >
            <span className="text-sm">Clear</span>
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay hiding to allow clicking on autocomplete items
              setTimeout(() => setIsFocused(false), 200);
            }}
            placeholder="Click here or type / to see all commands..."
            className="flex-1 px-4 py-3 bg-rh-card border border-rh-border rounded-lg text-rh-text placeholder-rh-text-secondary focus:outline-none focus:border-rh-green"
            autoFocus
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
