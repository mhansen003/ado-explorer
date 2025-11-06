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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

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
        setMessages(data.messages);
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
                  },
                ];
              });
              setIsStreaming(false);
              setStreamingContent('');
            } else if (data.type === 'title_update') {
              // Title was updated, refresh sidebar
              // Sidebar will auto-refresh on next load
            } else if (data.type === 'error') {
              console.error('Streaming error:', data.error);
              setIsStreaming(false);
              setStreamingContent('');
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
              <h2 className="text-2xl font-semibold text-rh-text mb-4">
                Welcome to ADO Explorer AI
              </h2>
              <p className="text-rh-text-muted mb-6 max-w-md">
                Start a new conversation to ask questions about your Azure DevOps work items,
                sprints, and project status.
              </p>
              <button
                onClick={handleNewConversation}
                className="px-6 py-3 bg-rh-green hover:bg-rh-green-hover text-white rounded-lg transition-colors"
              >
                Start New Conversation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
