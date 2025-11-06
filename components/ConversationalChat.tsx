'use client';

/**
 * Conversational Chat Component
 * Main component that integrates sidebar, chat area, and message input
 */

import { useState, useEffect, useCallback } from 'react';
import ConversationSidebar from './ConversationSidebar';
import ChatArea from './ChatArea';
import MessageInput from './MessageInput';
import { Message, Conversation } from '@/types/chat';

export default function ConversationalChat() {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSuggestions, setStreamingSuggestions] = useState<string[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [hasAutoCreated, setHasAutoCreated] = useState(false);

  // Auto-create a conversation if none exists
  useEffect(() => {
    if (!currentConversationId && !hasAutoCreated) {
      setHasAutoCreated(true);
      // Small delay to let UI render first
      setTimeout(() => {
        handleNewConversation();
      }, 100);
    }
  }, [currentConversationId, hasAutoCreated]);

  // Load conversation when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}`);
      const data = await response.json();

      if (data.success) {
        // If this is a new conversation with no messages, add welcome message
        if (data.messages.length === 0) {
          const welcomeMessage: Message = {
            id: 'welcome-' + Date.now(),
            role: 'assistant',
            content: `👋 Welcome to ADO Explorer AI!

I'm your AI-powered assistant for exploring Azure DevOps. I can help you with:

💬 **Natural Language Queries:**
- "list all projects"
- "show me active bugs"
- "what's in the current sprint?"
- "who are all the users?"

✨ **Smart Features:**
- Collection browsing (projects, teams, users, states, types, tags)
- Contextual follow-up suggestions after each response
- Conversation history and memory
- Beautiful data formatting with tables

Just ask me anything about your Azure DevOps organization in plain English!`,
            timestamp: Date.now(),
          };
          setMessages([welcomeMessage]);
        } else {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Conversation',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentConversationId(data.conversation.id);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversationId) {
      // Create new conversation if none exists
      await handleNewConversation();
      // Wait a bit for state to update, then retry
      setTimeout(() => handleSendMessage(content), 100);
      return;
    }

    // Add user message optimistically
    const userMessage: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Start streaming
    setIsStreaming(true);
    setStreamingContent('');

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch(
        `/api/conversations/${currentConversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        }
      );

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'token') {
              setStreamingContent(prev => prev + data.content);
            } else if (data.type === 'suggestions') {
              // Received AI-generated suggestions
              console.log('Received suggestions:', data.suggestions);
              setStreamingSuggestions(data.suggestions || []);
            } else if (data.type === 'done') {
              // Replace temp user message with real one
              setMessages(prev => {
                const filtered = prev.filter(m => m.id !== userMessage.id);
                return [
                  ...filtered,
                  {
                    id: data.userMessageId,
                    role: 'user',
                    content,
                    timestamp: Date.now(),
                  },
                  {
                    id: data.messageId,
                    role: 'assistant',
                    content: streamingContent,
                    timestamp: Date.now(),
                    suggestions: streamingSuggestions.length > 0 ? streamingSuggestions : undefined,
                  },
                ];
              });
              setIsStreaming(false);
              setStreamingContent('');
              setStreamingSuggestions([]);
            } else if (data.type === 'title_update') {
              // Title was updated, refresh sidebar
              // Sidebar will auto-refresh on next load
            } else if (data.type === 'error') {
              console.error('Streaming error:', data.error);
              setIsStreaming(false);
              setStreamingContent('');
              setStreamingSuggestions([]);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to send message:', error);
      }
      setIsStreaming(false);
      setStreamingContent('');
    } finally {
      setAbortController(null);
    }
  };

  const handleStopStreaming = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  // Handle clicking a suggestion - send it as a new message
  const handleSuggestionClick = (suggestion: string) => {
    console.log('Suggestion clicked:', suggestion);
    handleSendMessage(suggestion);
  };

  return (
    <div className="flex h-screen bg-rh-darker">
      {/* Sidebar */}
      <ConversationSidebar
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        currentConversationId={currentConversationId || undefined}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentConversationId ? (
          <>
            <ChatArea
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              streamingSuggestions={streamingSuggestions}
              onSuggestionClick={handleSuggestionClick}
            />
            <MessageInput
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              isStreaming={isStreaming}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rh-green/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-rh-green animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold text-rh-text mb-2">
                  Initializing conversation...
                </h2>
                <p className="text-rh-text-muted text-sm">
                  Setting up your AI-powered Azure DevOps assistant
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
