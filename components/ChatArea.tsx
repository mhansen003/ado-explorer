'use client';

/**
 * Chat Area Component
 * Displays messages in a conversation
 */

import { useEffect, useRef } from 'react';
import { User, Bot } from 'lucide-react';
import { Message } from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatAreaProps {
  messages: Message[];
  isStreaming?: boolean;
  streamingContent?: string;
  streamingSuggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  isVerifying?: boolean;
}

export default function ChatArea({
  messages,
  isStreaming = false,
  streamingContent = '',
  streamingSuggestions = [],
  onSuggestionClick,
  isVerifying = false,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      // Today - show time only
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else if (diff < 2 * oneDay) {
      // Yesterday
      return 'Yesterday ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } else {
      // Older - show date and time
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.length === 0 && !isStreaming && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <Bot className="w-16 h-16 text-rh-green mb-4" />
          <h3 className="text-xl font-semibold text-rh-text mb-2">
            Start a conversation
          </h3>
          <p className="text-rh-text-muted max-w-md">
            Ask me anything about your Azure DevOps work items, sprints, or project status.
          </p>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex gap-4 ${
            message.role === 'user' ? 'flex-row-reverse' : ''
          }`}
        >
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-blue-500/20'
                : 'bg-rh-green/20'
            }`}
          >
            {message.role === 'user' ? (
              <User className="w-5 h-5 text-blue-400" />
            ) : (
              <Bot className="w-5 h-5 text-rh-green" />
            )}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-rh-text">
                {message.role === 'user' ? 'You' : 'Assistant'}
              </span>
              <span className="text-xs text-rh-text-muted">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <div
              className={`rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-500/10 border border-blue-500/20'
                  : 'bg-rh-dark border border-rh-border'
              }`}
            >
              {message.role === 'user' ? (
                <div className="text-rh-text whitespace-pre-wrap">
                  {message.content}
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none
                  prose-headings:text-rh-text prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4
                  prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                  prose-p:text-rh-text prose-p:leading-relaxed prose-p:mb-3
                  prose-strong:text-rh-green prose-strong:font-semibold
                  prose-ul:my-3 prose-ul:space-y-1 prose-ul:list-disc prose-ul:pl-5
                  prose-ol:my-3 prose-ol:space-y-1 prose-ol:list-decimal prose-ol:pl-5
                  prose-li:leading-relaxed
                  prose-code:text-cyan-400 prose-code:bg-rh-card/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                  prose-pre:bg-rh-card prose-pre:border prose-pre:border-rh-border prose-pre:p-3 prose-pre:rounded-lg
                  prose-a:text-rh-green prose-a:no-underline hover:prose-a:underline
                  prose-blockquote:border-l-rh-green prose-blockquote:text-rh-text-muted prose-blockquote:italic
                  prose-table:w-full prose-table:border-collapse prose-table:my-4
                  prose-table:bg-rh-card/30 prose-table:border prose-table:border-rh-border prose-table:rounded-lg prose-table:overflow-hidden
                  prose-thead:bg-rh-card
                  prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-rh-green prose-th:border-b prose-th:border-rh-border
                  prose-td:px-4 prose-td:py-3 prose-td:text-rh-text prose-td:border-b prose-td:border-rh-border/50
                  prose-tr:transition-colors hover:prose-tr:bg-rh-card/50
                  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}

              {/* Suggestion buttons for assistant messages */}
              {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSuggestionClick?.(suggestion)}
                      className="px-3 py-1.5 text-sm bg-rh-card border border-rh-border rounded-lg
                                 text-rh-text hover:border-rh-green hover:bg-rh-green/10
                                 transition-all duration-200 hover:scale-[1.02]
                                 flex items-center gap-1.5 group"
                    >
                      <span className="text-rh-text-muted group-hover:text-rh-green transition-colors">✨</span>
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Streaming Message */}
      {isStreaming && (
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-rh-green/20">
            <Bot className="w-5 h-5 text-rh-green" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-rh-text">Assistant</span>
              {isVerifying ? (
                <span className="text-xs text-orange-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                  verifying response before sending...
                </span>
              ) : (
                <span className="text-xs text-rh-text-muted">typing...</span>
              )}
            </div>
            <div className="rounded-lg p-4 bg-rh-dark border border-rh-border">
              <div className="prose prose-invert prose-sm max-w-none
                prose-headings:text-rh-text prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4
                prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
                prose-p:text-rh-text prose-p:leading-relaxed prose-p:mb-3
                prose-strong:text-rh-green prose-strong:font-semibold
                prose-ul:my-3 prose-ul:space-y-1 prose-ul:list-disc prose-ul:pl-5
                prose-ol:my-3 prose-ol:space-y-1 prose-ol:list-decimal prose-ol:pl-5
                prose-li:leading-relaxed
                prose-code:text-cyan-400 prose-code:bg-rh-card/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                prose-pre:bg-rh-card prose-pre:border prose-pre:border-rh-border prose-pre:p-3 prose-pre:rounded-lg
                prose-table:w-full prose-table:border-collapse prose-table:my-4
                prose-table:bg-rh-card/30 prose-table:border prose-table:border-rh-border prose-table:rounded-lg prose-table:overflow-hidden
                prose-thead:bg-rh-card
                prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-rh-green prose-th:border-b prose-th:border-rh-border
                prose-td:px-4 prose-td:py-3 prose-td:text-rh-text prose-td:border-b prose-td:border-rh-border/50
                prose-tr:transition-colors hover:prose-tr:bg-rh-card/50
                [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent + '▊'}
                </ReactMarkdown>
              </div>

              {/* Suggestion buttons while streaming (if received early) */}
              {streamingSuggestions && streamingSuggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 animate-fade-in">
                  {streamingSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSuggestionClick?.(suggestion)}
                      className="px-3 py-1.5 text-sm bg-rh-card border border-rh-border rounded-lg
                                 text-rh-text hover:border-rh-green hover:bg-rh-green/10
                                 transition-all duration-200 hover:scale-[1.02]
                                 flex items-center gap-1.5 group opacity-80 hover:opacity-100"
                    >
                      <span className="text-rh-text-muted group-hover:text-rh-green transition-colors">✨</span>
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
