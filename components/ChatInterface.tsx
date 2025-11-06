'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import MessageList from './MessageList';
import CommandAutocomplete from './CommandAutocomplete';
import TemplateInputBuilder from './TemplateInputBuilder';
import FilterBar from './FilterBar';
import ChangelogModal from './ChangelogModal';
import ConversationSidebar from './ConversationSidebar';
import { Message, Command, DynamicSuggestion, GlobalFilters, ViewPreferences, CommandTemplate } from '@/types';
import { COMMAND_TEMPLATES } from '@/lib/command-templates';

const COMMANDS: Command[] = [
  { name: 'help', description: 'Show available commands', icon: '❓' },
  { name: 'clear', description: 'Clear conversation history', icon: '🗑️' },
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<DynamicSuggestion[]>([]);
  const [isLoadingDynamic, setIsLoadingDynamic] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isShowingTabAutocomplete, setIsShowingTabAutocomplete] = useState(false);
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
  const [cachedQueries, setCachedQueries] = useState<DynamicSuggestion[]>([]);
  const [cachedSprints, setCachedSprints] = useState<DynamicSuggestion[]>([]);

  // Multi-select state for tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Template state
  const [activeTemplate, setActiveTemplate] = useState<CommandTemplate | null>(null);

  // Command history
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [temporaryInput, setTemporaryInput] = useState('');

  // Global filters
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    ignoreClosed: false,
    ignoreStates: [],
    ignoreCreatedBy: [],
    onlyMyTickets: false,
    ignoreOlderThanDays: null,
  });

  // View preferences
  const [viewPreferences, setViewPreferences] = useState<ViewPreferences>({
    useGridView: true,
    useHierarchyView: false,
  });

  // Changelog modal state
  const [showChangelog, setShowChangelog] = useState(false);

  // Filter bar expansion state
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Conversation state - ENABLE conversation saving
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showConversationSidebar, setShowConversationSidebar] = useState(true);
  const [conversationInitialized, setConversationInitialized] = useState(false);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // Auto-create conversation on mount
  useEffect(() => {
    if (!activeConversationId && !conversationInitialized) {
      setConversationInitialized(true);
      createNewConversation();
    }
  }, [activeConversationId, conversationInitialized]);

  // Initialize with welcome message on first load
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `🤖 Welcome to ADO Explorer!

✨ **[Click here to see the latest features](#changelog)** ✨

💬 **Natural Language Search:**
Just type naturally! Examples:
• "show me all active bugs"
• "find tasks assigned to john"
• "ticket #12345"
• "what are the P1 items?"

**Tip:** Press ↑ (up arrow) to recall previous commands

Type **/help** for more info`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, []); // Only run once on mount

  // Helper: Create new conversation
  const createNewConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      const data = await response.json();
      if (data.success) {
        setActiveConversationId(data.conversation.id);
        console.log('[ChatInterface] Created conversation:', data.conversation.id);

        // Trigger sidebar refresh to show new conversation
        setSidebarRefreshKey(Date.now());
      }
    } catch (error) {
      console.error('[ChatInterface] Failed to create conversation:', error);
    }
  };

  // Helper: Save message to conversation
  const saveMessageToConversation = async (role: 'user' | 'assistant', content: string) => {
    if (!activeConversationId) return;

    try {
      await fetch(`/api/conversations/${activeConversationId}/save-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
      console.log('[ChatInterface] Saved message to conversation');
    } catch (error) {
      console.error('[ChatInterface] Failed to save message:', error);
    }
  };

  useEffect(() => {
    // Don't override if Tab autocomplete is showing
    if (isShowingTabAutocomplete) {
      return;
    }

    // Only show autocomplete for slash commands
    if (input.startsWith('/')) {
      // Show autocomplete when typing "/" or a slash command
      if (input === '/') {
        // Show templates instead of old commands
        setFilteredCommands([]);
        setDynamicSuggestions([]);
        setShowAutocomplete(true);
        setSelectedIndex(0);
        return;
      }
      const parts = input.slice(1).split(' ');
      const commandName = parts[0].toLowerCase();
      const param = parts.slice(1).join(' ').toLowerCase();

      // Filter static commands
      const filtered = COMMANDS.filter(cmd =>
        cmd.name.toLowerCase().includes(commandName)
      );

      // Check if we need to fetch dynamic suggestions or show cached data
      const isDynamicCommand = ['project', 'board', 'created_by', 'assigned_to', 'state', 'type', 'tag', 'query', 'sprint'].includes(commandName);

      if (param && isDynamicCommand) {
        // Fetch filtered results when user is typing
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
          case 'query':
            fetchQueries(param);
            break;
          case 'sprint':
            fetchSprints(param);
            break;
        }
      } else if (!param && isDynamicCommand) {
        // Show cached data when command has space but no parameter yet
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
            setIsMultiSelectMode(true);
            setSelectedTags([]);
            break;
          case 'query':
            cachedData = cachedQueries;
            break;
          case 'sprint':
            cachedData = cachedSprints;
            break;
        }
        setDynamicSuggestions(cachedData);
        setFilteredCommands(filtered);
        setShowAutocomplete(filtered.length > 0 || cachedData.length > 0);
        setSelectedIndex(0);
        return; // Early return to avoid the check below
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
  }, [input, dynamicSuggestions.length, isFocused, isShowingTabAutocomplete]);

  // Initialize messages only on client side to avoid hydration errors
  useEffect(() => {
    setIsClient(true);

    // Load command history from localStorage
    try {
      const savedHistory = localStorage.getItem('ado-command-history');
      if (savedHistory) {
        setCommandHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
    }

    const welcomeMessage: Message = {
      id: '1',
      type: 'system',
      content: `🤖 Welcome to ADO Explorer!

✨ **[Click here to see the latest features](#changelog)** ✨

💬 **Natural Language Search:**
Just type naturally! Examples:
• "show me all active bugs"
• "find tasks assigned to john"
• "ticket #12345"
• "what are the P1 items?"

**Tip:** Press ↑ (up arrow) to recall previous commands

Type **/help** for more info`,
      timestamp: new Date(),
    };

    const helpMessage: Message = {
      id: '2',
      type: 'system',
      content: '',
      timestamp: new Date(),
    };

    setMessages([welcomeMessage, helpMessage]);
  }, []); // Empty dependency array = run once on mount

  // Auto-focus input when user starts typing anywhere on the page
  useEffect(() => {
    const handleGlobalKeyPress = (event: KeyboardEvent) => {
      // Skip if user is already typing in an input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Skip if modifier keys are pressed (Ctrl, Alt, Meta)
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      // Skip special keys (Escape, Tab, Arrow keys, etc.)
      const specialKeys = ['Escape', 'Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Meta',
                          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                          'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
      if (specialKeys.includes(event.key)) {
        return;
      }

      // Focus the input for printable characters
      if (event.key.length === 1 && inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleGlobalKeyPress);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyPress);
    };
  }, []); // Empty dependency array = run once on mount

  // Pre-load all autocomplete data on mount
  useEffect(() => {
    const preloadData = async () => {
      console.log('[ChatInterface] Starting pre-load of autocomplete data...');

      // FIRST: Load filters from localStorage BEFORE anything else
      try {
        const FILTER_VERSION = '1.0'; // Increment when filter structure changes
        const savedVersion = localStorage.getItem('ado-explorer-filters-version');
        const savedFilters = localStorage.getItem('ado-explorer-filters');

        // Clear old filters if version mismatch
        if (savedVersion !== FILTER_VERSION && savedFilters) {
          console.log('[ChatInterface] Filter version mismatch, clearing old filters');
          localStorage.removeItem('ado-explorer-filters');
          localStorage.setItem('ado-explorer-filters-version', FILTER_VERSION);
        } else if (savedFilters) {
          const parsedFilters = JSON.parse(savedFilters);
          // Merge with defaults to ensure new fields exist
          const mergedFilters: GlobalFilters = {
            ignoreClosed: parsedFilters.ignoreClosed || false,
            ignoreStates: parsedFilters.ignoreStates || [],
            ignoreCreatedBy: parsedFilters.ignoreCreatedBy || [],
            onlyMyTickets: parsedFilters.onlyMyTickets || false,
            ignoreOlderThanDays: parsedFilters.ignoreOlderThanDays || null,
            currentUser: parsedFilters.currentUser,
          };
          setGlobalFilters(mergedFilters);
          console.log('[ChatInterface] Loaded filters from localStorage:', mergedFilters);
        } else {
          // No saved filters, set the version for future saves
          localStorage.setItem('ado-explorer-filters-version', FILTER_VERSION);
        }
      } catch (error) {
        console.error('[ChatInterface] Failed to load filters from localStorage:', error);
      }

      // Load view preferences
      try {
        const savedPrefs = localStorage.getItem('ado-explorer-view-preferences');
        if (savedPrefs) {
          const parsedPrefs = JSON.parse(savedPrefs);
          setViewPreferences(parsedPrefs);
          console.log('[ChatInterface] Loaded view preferences from localStorage:', parsedPrefs);
        }
      } catch (error) {
        console.error('[ChatInterface] Failed to load view preferences from localStorage:', error);
      }

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
        console.log('[ChatInterface] Fetching boards...');
        const response = await fetch('/api/boards');
        const data = await response.json();
        console.log('[ChatInterface] Boards response:', { ok: response.ok, data });
        if (response.ok && data.teams) {
          setCachedBoards(data.teams.map((t: any) => ({
            value: t.name,
            description: t.projectName ? `Project: ${t.projectName}` : undefined,
          })));
          console.log('[ChatInterface] Pre-loaded boards:', data.teams.length);
        } else {
          console.warn('[ChatInterface] Boards API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load boards:', err);
      }

      // Pre-load users
      try {
        console.log('[ChatInterface] Fetching users...');
        const response = await fetch('/api/users');
        const data = await response.json();
        console.log('[ChatInterface] Users response:', { ok: response.ok, data });
        if (response.ok && data.users) {
          setCachedUsers(data.users.map((u: any) => ({
            value: u.displayName,
            description: u.uniqueName || undefined,
          })));
          console.log('[ChatInterface] Pre-loaded users:', data.users.length);
        } else if (response.ok && Array.isArray(data)) {
          // API returns array directly
          setCachedUsers(data.map((u: any) => ({
            value: u.displayName,
            description: u.uniqueName || undefined,
          })));
          console.log('[ChatInterface] Pre-loaded users (array format):', data.length);
        } else {
          console.warn('[ChatInterface] Users API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load users:', err);
      }

      // Pre-load states
      try {
        console.log('[ChatInterface] Fetching states...');
        const response = await fetch('/api/states');
        const data = await response.json();
        console.log('[ChatInterface] States response:', { ok: response.ok, data });
        if (response.ok && data.states) {
          setCachedStates(data.states.map((s: string) => ({ value: s })));
          console.log('[ChatInterface] Pre-loaded states:', data.states.length);
        } else if (response.ok && Array.isArray(data)) {
          // API returns array directly
          setCachedStates(data.map((s: string) => ({ value: s })));
          console.log('[ChatInterface] Pre-loaded states (array format):', data.length);
        } else {
          console.warn('[ChatInterface] States API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load states:', err);
      }

      // Pre-load types
      try {
        console.log('[ChatInterface] Fetching types...');
        const response = await fetch('/api/types');
        const data = await response.json();
        console.log('[ChatInterface] Types response:', { ok: response.ok, data });
        if (response.ok && data.types) {
          setCachedTypes(data.types.map((t: string) => ({ value: t })));
          console.log('[ChatInterface] Pre-loaded types:', data.types.length);
        } else if (response.ok && Array.isArray(data)) {
          // API returns array directly
          setCachedTypes(data.map((t: string) => ({ value: t })));
          console.log('[ChatInterface] Pre-loaded types (array format):', data.length);
        } else {
          console.warn('[ChatInterface] Types API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load types:', err);
      }

      // Pre-load tags
      try {
        console.log('[ChatInterface] Fetching tags...');
        const response = await fetch('/api/tags');
        const data = await response.json();
        console.log('[ChatInterface] Tags response:', { ok: response.ok, data });
        if (response.ok && data.tags) {
          setCachedTags(data.tags.map((t: string) => ({ value: t })));
          console.log('[ChatInterface] Pre-loaded tags:', data.tags.length);
        } else if (response.ok && Array.isArray(data)) {
          // API returns array directly
          setCachedTags(data.map((t: string) => ({ value: t })));
          console.log('[ChatInterface] Pre-loaded tags (array format):', data.length);
        } else {
          console.warn('[ChatInterface] Tags API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load tags:', err);
      }

      // Pre-load queries
      try {
        console.log('[ChatInterface] Fetching queries...');
        const response = await fetch('/api/queries');
        const data = await response.json();
        console.log('[ChatInterface] Queries response:', { ok: response.ok, data });
        if (response.ok && data.queries) {
          setCachedQueries(data.queries.map((q: any) => ({
            value: q.id,
            description: q.name, // Use name for display/filtering instead of path
            metadata: q.path, // Store full path as metadata if needed
          })));
          console.log('[ChatInterface] Pre-loaded queries:', data.queries.length);
        } else if (response.ok && Array.isArray(data)) {
          // API returns array directly
          setCachedQueries(data.map((q: any) => ({
            value: q.id,
            description: q.name, // Use name for display/filtering instead of path
            metadata: q.path, // Store full path as metadata if needed
          })));
          console.log('[ChatInterface] Pre-loaded queries (array format):', data.length);
        } else {
          console.warn('[ChatInterface] Queries API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load queries:', err);
      }

      // Pre-load sprints
      try {
        console.log('[ChatInterface] Fetching sprints...');
        const response = await fetch('/api/sprints');
        const data = await response.json();
        console.log('[ChatInterface] Sprints response:', { ok: response.ok, data });
        if (response.ok && data.sprints) {
          setCachedSprints(data.sprints.map((s: any) => ({
            value: s.path,
            description: `${s.name}${s.timeFrame === 'current' ? ' (Current)' : ''}`,
            metadata: JSON.stringify({ id: s.id, startDate: s.startDate, finishDate: s.finishDate, timeFrame: s.timeFrame }),
          })));
          console.log('[ChatInterface] Pre-loaded sprints:', data.sprints.length);
        } else if (response.ok && Array.isArray(data)) {
          // API returns array directly
          setCachedSprints(data.map((s: any) => ({
            value: s.path,
            description: `${s.name}${s.timeFrame === 'current' ? ' (Current)' : ''}`,
            metadata: JSON.stringify({ id: s.id, startDate: s.startDate, finishDate: s.finishDate, timeFrame: s.timeFrame }),
          })));
          console.log('[ChatInterface] Pre-loaded sprints (array format):', data.length);
        } else {
          console.warn('[ChatInterface] Sprints API returned error:', data);
        }
      } catch (err) {
        console.warn('[ChatInterface] Could not pre-load sprints:', err);
      }
    };

    preloadData();
  }, []);

  // Helper function to build filter summary text
  const buildFilterSummary = (): string => {
    const filters: string[] = [];

    if (globalFilters.ignoreClosed) {
      filters.push('ignoring closed tickets');
    }

    if (Array.isArray(globalFilters.ignoreStates) && globalFilters.ignoreStates.length > 0) {
      filters.push(`not showing ${globalFilters.ignoreStates.join(', ')}`);
    }

    if (Array.isArray(globalFilters.ignoreCreatedBy) && globalFilters.ignoreCreatedBy.length > 0) {
      filters.push(`excluding ${globalFilters.ignoreCreatedBy.length} user${globalFilters.ignoreCreatedBy.length !== 1 ? 's' : ''}`);
    }

    if (globalFilters.onlyMyTickets && globalFilters.currentUser) {
      filters.push(`only showing tickets for ${globalFilters.currentUser}`);
    }

    if (globalFilters.ignoreOlderThanDays) {
      filters.push(`ignoring tickets older than ${globalFilters.ignoreOlderThanDays} days`);
    }

    return filters.length > 0 ? `\n🔍 Filters: ${filters.join(', ')}` : '';
  };

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

  const fetchQueries = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/queries');
      const data = await response.json();

      if (response.ok && data.queries) {
        const filtered = data.queries
          .filter((q: any) =>
            q.name.toLowerCase().includes(searchTerm) ||
            q.path.toLowerCase().includes(searchTerm)
          )
          .map((q: any) => ({
            value: q.id,
            description: q.name, // Use name for display/filtering instead of path
            metadata: q.path, // Store full path as metadata if needed
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching queries:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const fetchSprints = async (searchTerm: string) => {
    try {
      setIsLoadingDynamic(true);
      const response = await fetch('/api/sprints');
      const data = await response.json();

      if (response.ok && data.sprints) {
        const filtered = data.sprints
          .filter((s: any) =>
            s.name.toLowerCase().includes(searchTerm) ||
            s.path.toLowerCase().includes(searchTerm)
          )
          .map((s: any) => ({
            value: s.path,
            description: `${s.name}${s.timeFrame === 'current' ? ' (Current)' : ''}`,
            metadata: JSON.stringify({ id: s.id, startDate: s.startDate, finishDate: s.finishDate, timeFrame: s.timeFrame }),
          }));
        setDynamicSuggestions(filtered);
      }
    } catch (error) {
      console.error('Error fetching sprints:', error);
    } finally {
      setIsLoadingDynamic(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const trimmedInput = input.trim();

    // Auto-create conversation if none exists
    if (!activeConversationId) {
      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedInput.slice(0, 50), // Use first 50 chars as initial title
            model: 'claude-sonnet-4',
            systemPrompt: 'You are a helpful AI assistant integrated with Azure DevOps. You help users manage work items, understand project status, and provide insights.',
          }),
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setActiveConversationId(data.conversation.id);
        }
      } catch (error) {
        console.error('Failed to create conversation:', error);
        // Continue anyway - UI will still work without persistence
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    // Save user message to conversation (non-blocking)
    saveMessageToConversation('user', trimmedInput);

    // Add to command history (avoid duplicates at the end)
    setCommandHistory(prev => {
      const filtered = prev.filter(cmd => cmd !== trimmedInput);
      const newHistory = [...filtered, trimmedInput];
      // Keep only last 50 commands
      const limited = newHistory.slice(-50);
      // Save to localStorage
      try {
        localStorage.setItem('ado-command-history', JSON.stringify(limited));
      } catch (error) {
        console.error('Failed to save command history:', error);
      }
      return limited;
    });

    setInput('');
    setHistoryIndex(-1);
    setTemporaryInput('');
    setShowAutocomplete(false);
    setIsFilterExpanded(false); // Close filter dropdown when executing search

    // Process command
    await processCommand(trimmedInput);
  };

  const handleClearChat = async () => {
    // Clear and show welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `🤖 Welcome to ADO Explorer!

✨ **[Click here to see the latest features](#changelog)** ✨

💬 **Natural Language Search:**
Just type naturally! Examples:
• "show me all active bugs"
• "find tasks assigned to john"
• "ticket #12345"
• "what are the P1 items?"

**Tip:** Press ↑ (up arrow) to recall previous commands

Type **/help** for more info`,
      timestamp: new Date(),
    };

    setMessages([welcomeMessage]);
    setInput('');
    setShowAutocomplete(false);

    // Start a new conversation (will be created on first message)
    setActiveConversationId(null);
  };

  // Conversation handlers
  const handleNewConversation = async () => {
    // Create a new conversation in Redis immediately
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' }),
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setActiveConversationId(data.conversation.id);
        console.log('[ChatInterface] Created new conversation:', data.conversation.id);

        // Clear and show welcome message
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `🤖 Welcome to ADO Explorer!

✨ **[Click here to see the latest features](#changelog)** ✨

💬 **Natural Language Search:**
Just type naturally! Examples:
• "show me all active bugs"
• "find tasks assigned to john"
• "ticket #12345"
• "what are the P1 items?"

**Tip:** Press ↑ (up arrow) to recall previous commands

Type **/help** for more info`,
          timestamp: new Date(),
        };

        setMessages([welcomeMessage]);
        setInput('');
        setShowAutocomplete(false);
        setCommandHistory([]);

        // Trigger sidebar refresh to show new conversation immediately
        setSidebarRefreshKey(Date.now());
      }
    } catch (error) {
      console.error('[ChatInterface] Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setActiveConversationId(conversationId);

        // Convert conversation messages to UI Message format
        const uiMessages: Message[] = data.messages.map((msg: any) => {
          if (msg.role === 'user') {
            return {
              id: msg.id,
              type: 'user',
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            };
          } else if (msg.role === 'assistant') {
            // Assistant messages should be displayed as results with conversationalAnswer
            return {
              id: msg.id,
              type: 'results',
              content: '', // Content is shown in conversationalAnswer
              timestamp: new Date(msg.timestamp),
              conversationalAnswer: msg.content,
              workItems: [], // Empty for now - would need to be stored in metadata
            };
          } else {
            // System messages
            return {
              id: msg.id,
              type: 'system',
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            };
          }
        });

        setMessages(uiMessages);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const processCommand = async (command: string) => {
    // Auto-detect ticket numbers (e.g., "86230" or "#86230")
    const ticketNumberMatch = command.trim().match(/^#?(\d+)$/);
    if (ticketNumberMatch) {
      const ticketId = ticketNumberMatch[1];
      // Convert to ID search command
      command = `/id ${ticketId}`;
    }

    // If input doesn't start with '/', treat it as an AI prompt
    if (!command.startsWith('/')) {
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
          body: JSON.stringify({
            prompt: command,
            filters: globalFilters,
          }),
        });

        const data = await response.json();

        // Even if there's an error, show conversational answer if available
        if (!response.ok) {
          if (data.conversationalAnswer) {
            const errorMessage: Message = {
              id: Date.now().toString(),
              type: 'results',
              content: `⚠️ An error occurred while searching Azure DevOps`,
              timestamp: new Date(),
              workItems: [],
              conversationalAnswer: data.conversationalAnswer,
              isError: true, // Show in red - needs better prompting
            };
            setMessages(prev => [...prev.slice(0, -1), errorMessage]);

            // Save error response to conversation
            saveMessageToConversation('assistant', data.conversationalAnswer);
            return;
          }
          throw new Error(data.error || 'Failed to process prompt');
        }

        const aiNote = data.aiGenerated ? `\n\n🤖 AI-Generated Query: ${data.generatedQuery}` : '';
        const searchScope = data.searchScope ? ` (${data.searchScope})` : '';
        const filterSummary = buildFilterSummary();

        // Detect if this is an error response even though HTTP was OK
        const isErrorResponse = data.conversationalAnswer && (
          data.conversationalAnswer.toLowerCase().includes('error') ||
          data.conversationalAnswer.toLowerCase().includes('issue') ||
          data.conversationalAnswer.toLowerCase().includes('problem') ||
          data.conversationalAnswer.toLowerCase().includes('failed') ||
          data.conversationalAnswer.toLowerCase().includes('status code')
        ) && (!data.workItems || data.workItems.length === 0);

        const resultMessage: Message = {
          id: Date.now().toString(),
          type: 'results',
          content: `Results for: "${command}"${searchScope}${aiNote}${filterSummary}`,
          timestamp: new Date(),
          workItems: data.workItems || [],
          conversationalAnswer: data.conversationalAnswer,
          responseType: data.responseType,
          suggestions: data.suggestions,
          isError: isErrorResponse, // Show in red if AI is describing an error
        };
        setMessages(prev => [...prev.slice(0, -1), resultMessage]);

        // Save AI response to conversation if available
        if (data.conversationalAnswer) {
          saveMessageToConversation('assistant', data.conversationalAnswer);
        }
      } catch (error: any) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `❌ Error: ${error.message}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev.slice(0, -1), errorMessage]);
      }
      return;
    }

    if (command.startsWith('/help')) {
      const helpMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `🤖 **ADO Explorer Help**

💬 **Natural Language Search:**
Just type naturally - I understand questions like:
• "show me all active bugs"
• "find tasks assigned to john"
• "ticket #12345"
• "what are the P1 bugs?"
• "show me closed items from last week"

**Tips:**
• Press ↑ (up arrow) to recall previous commands
• Use global filters (right side) to refine results
• Click work items to see details and discussion
• Type /clear to start fresh`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, helpMessage]);
      return;
    }

    // Handle /chart command
    if (command.startsWith('/chart ')) {
      const parts = command.split(' ');
      const chartType = parts[1] as 'pie' | 'bar' | 'line' | 'area';
      const dataKey = parts[2] as 'state' | 'type' | 'priority' | 'assignedTo' | 'createdBy';
      const project = parts.slice(3).join(' '); // Optional project parameter

      let workItems: any[] = [];
      let chartTitle = '';

      // If project is specified, fetch work items for that project
      if (project) {
        const loadingMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `Fetching work items for ${project}...`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, loadingMessage]);

        try {
          const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              command: `/project ${project}`,
              filters: globalFilters,
            }),
          });

          const data = await response.json();

          // Remove loading message
          setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));

          if (response.ok && data.workItems) {
            workItems = data.workItems;
            chartTitle = `${project} - `;
          } else {
            const errorMessage: Message = {
              id: Date.now().toString(),
              type: 'system',
              content: `❌ Could not fetch work items for project: ${project}`,
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
            return;
          }
        } catch (error) {
          setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'system',
            content: `❌ Error fetching work items: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
          return;
        }
      } else {
        // Find the most recent results message with work items
        const lastResultsMessage = [...messages].reverse().find(m => m.type === 'results' && m.workItems && m.workItems.length > 0);

        if (!lastResultsMessage || !lastResultsMessage.workItems) {
          const errorMessage: Message = {
            id: Date.now().toString(),
            type: 'system',
            content: '❌ No work items found to chart. Please run a search first or specify a project.',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
          return;
        }
        workItems = lastResultsMessage.workItems;
      }

      // Import the chart processing function dynamically
      const { processWorkItemsToChartData, getDataKeyLabel } = await import('@/lib/chart-utils');

      // Generate chart data
      const chartData = processWorkItemsToChartData(workItems, chartType, dataKey);

      const chartMessage: Message = {
        id: Date.now().toString(),
        type: 'results',
        content: `📊 ${chartTitle}${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart - ${getDataKeyLabel(dataKey)}`,
        timestamp: new Date(),
        chartData,
        workItems, // Include work items for reference
      };

      setMessages(prev => [...prev, chartMessage]);
      return;
    }

    // Handle /query command specially
    if (command.startsWith('/query ')) {
      const parts = command.split(' ');
      const queryId = parts.slice(1).join(' ');

      const loadingMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: 'Running saved query...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, loadingMessage]);

      try {
        const response = await fetch('/api/run-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ queryId, filters: globalFilters }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to run query');
        }

        const filterSummary = buildFilterSummary();
        const queryName = data.queryName || 'Query';
        const resultMessage: Message = {
          id: Date.now().toString(),
          type: 'results',
          content: `📋 Query: "${queryName}"${filterSummary}`,
          timestamp: new Date(),
          workItems: data.workItems || [],
        };
        setMessages(prev => [...prev.slice(0, -1), resultMessage]);
      } catch (error: any) {
        console.error('Query error:', error.message);
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: `❌ Error: ${error.message}`,
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
      // Call the API with global filters
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command, filters: globalFilters }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search work items');
      }

      // Show results
      const searchScope = data.searchScope ? ` (${data.searchScope})` : '';
      const filterSummary = buildFilterSummary();
      const resultMessage: Message = {
        id: Date.now().toString(),
        type: 'results',
        content: `Results for: ${command}${searchScope}${filterSummary}`,
        timestamp: new Date(),
        workItems: data.workItems || [],
      };
      setMessages(prev => [...prev.slice(0, -1), resultMessage]);
    } catch (error: any) {
      // Show error message
      console.error('API error:', error.message);
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
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
    setIsShowingTabAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleDynamicSelect = async (value: string, description?: string) => {
    // Get the current command name
    const parts = input.slice(1).split(' ');
    const commandName = parts[0];

    // For tag command, support multi-select
    if (commandName === 'tag' && isMultiSelectMode) {
      handleToggleTag(value);
      return;
    }

    // Build the full command (use ID for execution)
    const fullCommand = `/${commandName} ${value}`;

    // For display, use description if available (for queries and sprints)
    const displayValue = description || value;
    const displayCommand = `/${commandName} ${displayValue}`;

    // Add user message with human-readable display
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: displayCommand,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Clear input and close dropdown
    setInput('');
    setDynamicSuggestions([]);
    setShowAutocomplete(false);
    setIsShowingTabAutocomplete(false);
    setIsFilterExpanded(false); // Close filter dropdown when executing search

    // Execute the command (using the ID for queries)
    await processCommand(fullCommand);
  };

  const handleTemplateSelect = (template: CommandTemplate) => {
    // Set the active template to show TemplateInputBuilder
    setActiveTemplate(template);
    setShowAutocomplete(false);
    setInput(''); // Clear input
  };

  const handleTemplateExecute = async (command: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: command,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Close template builder
    setActiveTemplate(null);
    setInput('');
    setIsFilterExpanded(false); // Close filter dropdown when executing search

    // Execute the command
    await processCommand(command);
  };

  const handleTemplateCancel = () => {
    setActiveTemplate(null);
    setInput('');
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    // Reset history navigation when user types
    setHistoryIndex(-1);
    // Reset Tab autocomplete flag when user types
    if (isShowingTabAutocomplete) {
      setIsShowingTabAutocomplete(false);
    }
    // Collapse filter bar when user starts typing
    if (isFilterExpanded && e.target.value.length > 0) {
      setIsFilterExpanded(false);
    }
  };

  const handleListItemClick = async (value: string, commandName: string) => {
    // Execute the command with the selected value
    const command = `/${commandName} ${value}`;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: command,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Close filter dropdown when executing search
    setIsFilterExpanded(false);

    // Process the command
    await processCommand(command);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    // Add user message with the suggestion
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: suggestion,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Close filter dropdown when executing search
    setIsFilterExpanded(false);

    // Process the suggestion as a new query
    await processCommand(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle command history navigation (when no autocomplete showing)
    if (!showAutocomplete && commandHistory.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex === -1) {
          // First time pressing up - save current input and go to most recent
          setTemporaryInput(input);
          setHistoryIndex(commandHistory.length - 1);
          setInput(commandHistory[commandHistory.length - 1]);
        } else if (historyIndex > 0) {
          // Go further back in history
          setHistoryIndex(historyIndex - 1);
          setInput(commandHistory[historyIndex - 1]);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) {
          // Already at the bottom, do nothing
          return;
        } else if (historyIndex < commandHistory.length - 1) {
          // Go forward in history
          setHistoryIndex(historyIndex + 1);
          setInput(commandHistory[historyIndex + 1]);
        } else {
          // Reached the end - restore temporary input
          setHistoryIndex(-1);
          setInput(temporaryInput);
        }
        return;
      }
    }

    // Calculate total items in autocomplete (including templates when showing)
    const activeTemplates = input === '/' ? COMMAND_TEMPLATES : [];
    const totalItems = activeTemplates.length + filteredCommands.length + dynamicSuggestions.length;

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
        // Toggle the currently selected tag (adjust for templates)
        const adjustedIndex = selectedIndex - activeTemplates.length;
        if (adjustedIndex >= filteredCommands.length) {
          const suggestionIndex = adjustedIndex - filteredCommands.length;
          if (suggestionIndex < dynamicSuggestions.length) {
            handleToggleTag(dynamicSuggestions[suggestionIndex].value);
          }
        }
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        // If input doesn't start with '/', it's an AI prompt - send directly
        if (!input.startsWith('/')) {
          setShowAutocomplete(false);
          handleSend();
          return;
        }

        // If in multi-select mode with tags selected, send the search
        if (isMultiSelectMode && selectedTags.length > 0) {
          setShowAutocomplete(false);
          setIsMultiSelectMode(false);
          handleSend();
          return;
        }

        // Handle template selection
        if (selectedIndex < activeTemplates.length) {
          handleTemplateSelect(activeTemplates[selectedIndex]);
          return;
        }

        // Adjust index for commands and suggestions (after templates)
        const adjustedIndex = selectedIndex - activeTemplates.length;

        // Only select from autocomplete if there are actual items to select
        const hasValidSelection = (adjustedIndex < filteredCommands.length) ||
                                 (adjustedIndex >= filteredCommands.length &&
                                  (adjustedIndex - filteredCommands.length) < dynamicSuggestions.length);

        if (hasValidSelection && (filteredCommands.length > 0 || dynamicSuggestions.length > 0)) {
          // Select the highlighted item
          if (adjustedIndex < filteredCommands.length) {
            handleCommandSelect(filteredCommands[adjustedIndex]);
          } else {
            const suggestionIndex = adjustedIndex - filteredCommands.length;
            if (suggestionIndex < dynamicSuggestions.length) {
              const suggestion = dynamicSuggestions[suggestionIndex];
              handleDynamicSelect(suggestion.value, suggestion.description);
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

        // Check if user has typed a command with or without space (e.g., "/project" or "/project ")
        const parts = input.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const hasSpace = input.endsWith(' ');
        const isJustCommand = !hasSpace && parts.length === 1;

        console.log('[Tab Handler]', {
          input,
          commandName,
          hasSpace,
          isJustCommand,
          parts,
          cachedProjectsLength: cachedProjects.length,
          cachedBoardsLength: cachedBoards.length,
          cachedUsersLength: cachedUsers.length,
          cachedStatesLength: cachedStates.length,
          cachedTypesLength: cachedTypes.length,
          cachedTagsLength: cachedTags.length,
          cachedQueriesLength: cachedQueries.length,
        });

        // If autocomplete is already showing, Tab should SELECT like Enter does
        if (showAutocomplete && (activeTemplates.length > 0 || filteredCommands.length > 0 || dynamicSuggestions.length > 0)) {
          // Handle template selection first
          if (selectedIndex < activeTemplates.length) {
            handleTemplateSelect(activeTemplates[selectedIndex]);
            return;
          }

          const adjustedIndex = selectedIndex - activeTemplates.length;
          const hasValidSelection = (adjustedIndex < filteredCommands.length) ||
                                   (adjustedIndex >= filteredCommands.length &&
                                    (adjustedIndex - filteredCommands.length) < dynamicSuggestions.length);

          if (hasValidSelection) {
            // Select the highlighted item (same logic as Enter)
            if (adjustedIndex < filteredCommands.length) {
              handleCommandSelect(filteredCommands[adjustedIndex]);
            } else {
              const suggestionIndex = adjustedIndex - filteredCommands.length;
              if (suggestionIndex < dynamicSuggestions.length) {
                const suggestion = dynamicSuggestions[suggestionIndex];
                handleDynamicSelect(suggestion.value, suggestion.description);
              }
            }
            return;
          }
        }

        // If command with or without space, show all cached options for that command
        if ((hasSpace && parts.length === 2 && parts[1] === '') || isJustCommand) {
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
            case 'query':
              cachedData = cachedQueries;
              break;
            case 'sprint':
              cachedData = cachedSprints;
              break;
          }

          console.log('[Tab Handler] Showing cached data for', commandName, ':', cachedData.length, 'items');

          if (cachedData.length > 0) {
            setDynamicSuggestions(cachedData);
            setFilteredCommands([]);
            setIsShowingTabAutocomplete(true);
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

  // Handle chart creation from existing results
  const handleCreateChart = async (
    chartType: 'pie' | 'bar' | 'line' | 'area',
    dataKey: 'state' | 'type' | 'priority' | 'assignedTo' | 'createdBy' | 'project' | 'areaPath' | 'changedBy' | 'iterationPath' | 'storyPoints' | 'tags',
    workItems: any[]
  ) => {
    // Import the chart processing function dynamically
    const { processWorkItemsToChartData, getDataKeyLabel } = await import('@/lib/chart-utils');

    // Generate chart data
    const chartData = processWorkItemsToChartData(workItems, chartType, dataKey);

    const chartMessage: Message = {
      id: Date.now().toString(),
      type: 'results',
      content: `📊 ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart - ${getDataKeyLabel(dataKey)}`,
      timestamp: new Date(),
      chartData,
      workItems, // Include work items for reference and pivot changes
    };

    setMessages(prev => [...prev, chartMessage]);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Conversation Sidebar - LEFT */}
      <ConversationSidebar
        key={sidebarRefreshKey}
        currentConversationId={activeConversationId || undefined}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isCollapsed={!showConversationSidebar}
        onToggleCollapse={() => setShowConversationSidebar(!showConversationSidebar)}
      />

      {/* Main Chat Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <MessageList
        messages={messages}
        onListItemClick={handleListItemClick}
        onSuggestionClick={handleSuggestionClick}
        viewPreferences={viewPreferences}
        globalFilters={globalFilters}
        onOpenFilters={() => setIsFilterExpanded(true)}
        onChangelogClick={() => setShowChangelog(true)}
        onCreateChart={handleCreateChart}
      />

      <FilterBar
        filters={globalFilters}
        onFiltersChange={setGlobalFilters}
        viewPreferences={viewPreferences}
        onViewPreferencesChange={setViewPreferences}
        isExpanded={isFilterExpanded}
        onExpandedChange={setIsFilterExpanded}
      />

      <div className="relative p-4 border-t border-rh-border bg-rh-dark">
        {activeTemplate && (
          <TemplateInputBuilder
            template={activeTemplate}
            onExecute={handleTemplateExecute}
            onCancel={handleTemplateCancel}
            projects={cachedProjects}
            boards={cachedBoards}
            users={cachedUsers}
            states={cachedStates}
            types={cachedTypes}
            tags={cachedTags}
            queries={cachedQueries}
            sprints={cachedSprints}
          />
        )}

        {showAutocomplete && !activeTemplate && (
          <CommandAutocomplete
            commands={filteredCommands}
            templates={input === '/' ? COMMAND_TEMPLATES : []}
            dynamicSuggestions={dynamicSuggestions}
            isLoadingDynamic={isLoadingDynamic}
            onSelect={handleCommandSelect}
            onSelectTemplate={handleTemplateSelect}
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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              // Delay hiding to allow clicking on autocomplete items
              setTimeout(() => setIsFocused(false), 200);
            }}
            placeholder="Ask anything naturally, or type / for commands..."
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

        {/* Changelog Modal */}
        {showChangelog && (
          <ChangelogModal onClose={() => setShowChangelog(false)} />
        )}
      </div>
    </div>
  );
}
