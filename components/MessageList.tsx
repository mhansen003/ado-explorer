import { Message, ViewPreferences, GlobalFilters } from '@/types';
import WorkItemCard from './WorkItemCard';
import WorkItemGrid from './WorkItemGrid';
import WorkItemChart from './WorkItemChart';
import AnalyticsInsights from './AnalyticsInsights';
import { Bot, User, Download, Table, BarChart3, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ResultsModal from './ResultsModal';

interface MessageListProps {
  messages: Message[];
  onListItemClick?: (value: string, commandName: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  viewPreferences: ViewPreferences;
  globalFilters: GlobalFilters;
  onOpenFilters?: () => void;
  onChangelogClick?: () => void;
  onCreateChart?: (chartType: 'pie' | 'bar' | 'line' | 'area', dataKey: 'state' | 'type' | 'priority' | 'assignedTo' | 'createdBy' | 'project' | 'areaPath' | 'changedBy' | 'iterationPath' | 'storyPoints' | 'tags', workItems: any[]) => void;
}

export default function MessageList({ messages, onListItemClick, onSuggestionClick, viewPreferences, globalFilters, onOpenFilters, onChangelogClick, onCreateChart }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [modalMessage, setModalMessage] = useState<Message | null>(null);
  const [chartDropdownOpen, setChartDropdownOpen] = useState<string | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close chart dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) {
        setChartDropdownOpen(null);
      }
    };

    if (chartDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [chartDropdownOpen]);

  // Build filter description for display
  const buildFilterDescription = (): string => {
    const filterParts: string[] = [];

    if (globalFilters.ignoreClosed) {
      filterParts.push('not showing closed');
    }

    if (Array.isArray(globalFilters.ignoreStates) && globalFilters.ignoreStates.length > 0) {
      filterParts.push(`not showing ${globalFilters.ignoreStates.join(', ')}`);
    }

    if (globalFilters.onlyMyTickets) {
      filterParts.push('only my tickets');
    }

    if (globalFilters.ignoreOlderThanDays !== null) {
      filterParts.push(`not showing older than ${globalFilters.ignoreOlderThanDays} days`);
    }

    return filterParts.length > 0 ? ` (${filterParts.join('; ')})` : '';
  };

  const exportToCSV = (message: Message) => {
    if (!message.workItems || message.workItems.length === 0) return;

    const headers = ['ID', 'Title', 'Type', 'State', 'Priority', 'Assigned To', 'Created By', 'Created Date', 'Project'];
    const rows = message.workItems.map(item => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`,
      item.type,
      item.state,
      `P${item.priority}`,
      item.assignedTo,
      item.createdBy,
      new Date(item.createdDate).toLocaleDateString(),
      item.project || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ado-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = (message: Message) => {
    if (!message.workItems || message.workItems.length === 0) return;

    const json = JSON.stringify(message.workItems, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ado-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parse markdown links and render them as clickable elements
  const renderMarkdownContent = (content: string) => {
    // Regex to match markdown links: [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = markdownLinkRegex.exec(content)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      const linkText = match[1];
      const linkUrl = match[2];

      // Handle #changelog links specially
      if (linkUrl === '#changelog') {
        parts.push(
          <button
            key={match.index}
            onClick={(e) => {
              e.preventDefault();
              onChangelogClick?.();
            }}
            className="text-rh-green hover:text-green-400 underline cursor-pointer font-semibold"
          >
            {linkText}
          </button>
        );
      } else {
        // Regular links
        parts.push(
          <a
            key={match.index}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-rh-green hover:text-green-400 underline"
          >
            {linkText}
          </a>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last link
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            {message.type === 'user' ? (
              <div className="w-8 h-8 rounded-full bg-rh-green flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-rh-dark" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-rh-card border border-rh-border flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-rh-green" />
              </div>
            )}

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-rh-text">
                  {message.type === 'user' ? 'You' : 'ADO Explorer'}
                </span>
                <span className="text-xs text-rh-text-secondary">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>

              {/* Conversational Answer */}
              {message.conversationalAnswer && (
                <div className="mb-3 p-4 bg-rh-green/10 border border-rh-green/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-rh-green" />
                    <span className="text-sm font-medium text-rh-green">AI Answer</span>
                  </div>
                  <p className="text-sm text-rh-text whitespace-pre-wrap">
                    {message.conversationalAnswer}
                  </p>
                </div>
              )}

              {/* AI Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mb-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-400">Suggested Follow-ups</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => onSuggestionClick?.(suggestion)}
                        className="px-3 py-1.5 text-xs bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-lg hover:bg-purple-500/30 hover:border-purple-400 transition-all font-medium"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chart Visualization */}
              {message.chartData && (
                <WorkItemChart chartData={message.chartData} workItems={message.workItems} />
              )}

              {/* Analytics Display */}
              {message.isAnalytics && message.analyticsData && (
                <AnalyticsInsights
                  data={message.analyticsData}
                  conversationalAnswer={message.conversationalAnswer}
                />
              )}

              {message.type === 'results' && message.workItems && !message.isAnalytics ? (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-rh-text-secondary">
                        Found {message.workItems.length} work items{buildFilterDescription()}
                      </p>
                      {message.workItems.length === 0 && (
                        globalFilters.ignoreClosed ||
                        (Array.isArray(globalFilters.ignoreStates) && globalFilters.ignoreStates.length > 0) ||
                        (Array.isArray(globalFilters.ignoreCreatedBy) && globalFilters.ignoreCreatedBy.length > 0) ||
                        globalFilters.onlyMyTickets ||
                        globalFilters.ignoreOlderThanDays
                      ) && onOpenFilters && (
                        <button
                          onClick={onOpenFilters}
                          className="text-xs text-rh-green hover:underline text-left"
                        >
                          💡 Try adjusting your filters to see more results
                        </button>
                      )}
                    </div>
                    {message.workItems.length > 0 && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => exportToCSV(message)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-rh-dark border border-rh-border rounded hover:border-rh-green transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          CSV
                        </button>
                        <button
                          onClick={() => exportToJSON(message)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-rh-dark border border-rh-border rounded hover:border-rh-green transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          JSON
                        </button>

                        {/* Render Chart Dropdown */}
                        {onCreateChart && (
                          <div className="relative">
                            <button
                              onClick={() => setChartDropdownOpen(chartDropdownOpen === message.id ? null : message.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 rounded transition-colors"
                            >
                              <BarChart3 className="w-3 h-3" />
                              Chart
                              <ChevronDown className="w-3 h-3" />
                            </button>

                            {chartDropdownOpen === message.id && (
                              <div className="absolute right-0 mt-1 w-48 bg-rh-card border border-rh-border rounded-lg shadow-2xl z-50 overflow-hidden">
                                <div className="p-2">
                                  <div className="text-xs font-medium text-rh-text-secondary mb-2 px-2">Chart Type</div>
                                  {['pie', 'bar', 'line', 'area'].map((chartType) => (
                                    <div key={chartType} className="mb-2">
                                      <button
                                        onClick={() => {
                                          setChartDropdownOpen(null);
                                          onCreateChart(chartType as any, 'state', message.workItems!);
                                        }}
                                        className="w-full text-left px-2 py-1.5 text-xs text-rh-text hover:bg-rh-border rounded transition-colors capitalize"
                                      >
                                        {chartType} Chart
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {message.workItems.length > 5 && (
                          <button
                            onClick={() => setModalMessage(message)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-rh-green text-rh-dark rounded hover:bg-green-600 transition-colors"
                          >
                            <Table className="w-3 h-3" />
                            View All
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Conditional rendering: Grid View or Card View */}
                  {viewPreferences.useGridView ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-rh-border">
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">ID</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">State</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Title</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-rh-text-secondary">Priority</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Assigned</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Project</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Area</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-rh-text-secondary">Changed</th>
                            <th className="px-3 py-2 text-center text-xs font-medium text-rh-text-secondary">SP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {message.workItems.slice(0, message.workItems.length <= 10 ? message.workItems.length : 10).map((item) => (
                            <WorkItemGrid key={item.id} workItem={item} />
                          ))}
                        </tbody>
                      </table>

                      {/* Show "and X more" message if > 10 for grid view */}
                      {message.workItems.length > 10 && (
                        <div className="text-center py-3">
                          <button
                            onClick={() => setModalMessage(message)}
                            className="text-sm text-rh-green hover:text-green-400 transition-colors"
                          >
                            ... and {message.workItems.length - 10} more items (click &quot;View All&quot; to see them)
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Show first 5 items or all if <= 5 for card view */}
                      {message.workItems.slice(0, message.workItems.length <= 5 ? message.workItems.length : 5).map((item) => (
                        <WorkItemCard key={item.id} workItem={item} />
                      ))}

                      {/* Show "and X more" message if > 5 for card view */}
                      {message.workItems.length > 5 && (
                        <div className="text-center py-3">
                          <button
                            onClick={() => setModalMessage(message)}
                            className="text-sm text-rh-green hover:text-green-400 transition-colors"
                          >
                            ... and {message.workItems.length - 5} more items (click &quot;View All&quot; to see them)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : message.listItems && message.listItems.length > 0 ? (
                <div className="mt-3">
                  <div className="text-rh-text whitespace-pre-wrap text-sm mb-3">
                    {renderMarkdownContent(message.content)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                    {message.listItems.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => onListItemClick?.(item.value, item.commandName || '')}
                        className="flex flex-col items-start p-3 bg-rh-card border border-rh-border rounded-lg hover:border-rh-green hover:bg-rh-border transition-colors text-left"
                      >
                        <span className="text-rh-text font-medium text-sm">
                          {item.value}
                        </span>
                        {item.description && (
                          <span className="text-rh-text-secondary text-xs mt-1">
                            {item.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-rh-text whitespace-pre-wrap text-sm">
                  {renderMarkdownContent(message.content)}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Results Modal */}
      {modalMessage && (
        <ResultsModal
          message={modalMessage}
          onClose={() => setModalMessage(null)}
        />
      )}
    </>
  );
}
