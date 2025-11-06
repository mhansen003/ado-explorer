'use client';

/**
 * Conversation Sidebar
 * Shows list of user's conversations grouped by date
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { ConversationSummary } from '@/types/chat';

interface ConversationSidebarProps {
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  currentConversationId?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function ConversationSidebar({
  onSelectConversation,
  onNewConversation,
  currentConversationId,
  isCollapsed = false,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/conversations');
      const data = await response.json();

      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Delete this conversation?')) {
      return;
    }

    setDeletingId(conversationId);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));

        // If deleting current conversation, select another or create new
        if (conversationId === currentConversationId) {
          const remaining = conversations.filter(c => c.id !== conversationId);
          if (remaining.length > 0) {
            onSelectConversation(remaining[0].id);
          } else {
            onNewConversation();
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Group conversations by date
  const groupByDate = (conversations: ConversationSummary[]) => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;
    const thirtyDays = 30 * oneDay;

    const groups: Record<string, ConversationSummary[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 Days': [],
      'Last 30 Days': [],
      Older: [],
    };

    conversations.forEach(conv => {
      const age = now - conv.updatedAt;

      if (age < oneDay) {
        groups.Today.push(conv);
      } else if (age < 2 * oneDay) {
        groups.Yesterday.push(conv);
      } else if (age < sevenDays) {
        groups['Last 7 Days'].push(conv);
      } else if (age < thirtyDays) {
        groups['Last 30 Days'].push(conv);
      } else {
        groups.Older.push(conv);
      }
    });

    // Filter out empty groups
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  };

  const groupedConversations = groupByDate(conversations);

  if (isCollapsed) {
    return (
      <div className="w-16 bg-rh-card border-r border-rh-border flex flex-col items-center py-4 gap-4">
        <button
          onClick={onToggleCollapse}
          className="p-3 rounded-lg bg-rh-green hover:bg-rh-green-hover transition-colors"
          title="Expand sidebar"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={onNewConversation}
          className="p-3 rounded-lg bg-rh-dark hover:bg-rh-darker transition-colors"
          title="New conversation"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-rh-card border-r border-rh-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-rh-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-rh-green" />
          <h2 className="font-semibold text-rh-text">Conversations</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewConversation}
            className="p-2 rounded-lg bg-rh-green hover:bg-rh-green-hover transition-colors"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-lg hover:bg-rh-darker transition-colors"
              title="Collapse sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-rh-text-muted">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-rh-text-muted mb-4">No conversations yet</p>
            <button
              onClick={onNewConversation}
              className="px-4 py-2 bg-rh-green hover:bg-rh-green-hover rounded-lg transition-colors"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          <div className="py-2">
            {groupedConversations.map(([group, items]) => (
              <div key={group} className="mb-4">
                <div className="px-4 py-2 text-xs font-semibold text-rh-text-muted uppercase tracking-wider">
                  {group}
                </div>
                {items.map(conversation => (
                  <button
                    key={conversation.id}
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-rh-darker transition-colors group ${
                      conversation.id === currentConversationId
                        ? 'bg-rh-darker border-l-2 border-rh-green'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-rh-text truncate">
                          {conversation.title}
                        </div>
                        {conversation.lastMessagePreview && (
                          <div className="text-xs text-rh-text-muted truncate mt-1">
                            {conversation.lastMessagePreview}
                          </div>
                        )}
                        <div className="text-xs text-rh-text-muted mt-1">
                          {conversation.messageCount} messages
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(conversation.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                        disabled={deletingId === conversation.id}
                        title="Delete conversation"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
