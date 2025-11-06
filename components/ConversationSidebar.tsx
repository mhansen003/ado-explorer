'use client';

/**
 * Conversation Sidebar
 * Shows list of user's conversations grouped by date
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, X, AlertTriangle } from 'lucide-react';
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTitle, setConfirmDeleteTitle] = useState<string>('');
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

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

  const handleDeleteClick = (conversationId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(conversationId);
    setConfirmDeleteTitle(title);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;

    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);

    try {
      const response = await fetch(`/api/conversations/${confirmDeleteId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== confirmDeleteId));

        // If deleting current conversation, select another or create new
        if (confirmDeleteId === currentConversationId) {
          const remaining = conversations.filter(c => c.id !== confirmDeleteId);
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

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
    setConfirmDeleteTitle('');
  };

  const handleDeleteAll = async () => {
    if (conversations.length === 0) return;

    setIsDeletingAll(true);
    try {
      // Delete all conversations
      const deletePromises = conversations.map(conv =>
        fetch(`/api/conversations/${conv.id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      // Clear local state
      setConversations([]);
      setShowDeleteAllConfirm(false);

      // Create a new conversation
      onNewConversation();
    } catch (error) {
      console.error('Failed to delete all conversations:', error);
      alert('Failed to delete some conversations. Please try again.');
    } finally {
      setIsDeletingAll(false);
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
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={conversations.length === 0}
            className="p-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete all conversations"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
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
            <p className="text-rh-text-muted text-sm">No conversations yet</p>
            <p className="text-xs text-rh-text-muted mt-2">Click the + button above to start</p>
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
                    className={`w-full px-4 py-3 text-left hover:bg-rh-darker transition-colors group relative ${
                      conversation.id === currentConversationId
                        ? 'bg-rh-green/10 border-l-4 border-rh-green'
                        : ''
                    }`}
                  >
                    {/* Active indicator dot */}
                    {conversation.id === currentConversationId && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-rh-green rounded-full animate-pulse" />
                    )}
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
                        <div className="text-xs text-rh-text-muted mt-1 flex items-center gap-2">
                          <span>{conversation.messageCount} messages</span>
                          {(() => {
                            const age = Date.now() - conversation.updatedAt;
                            const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
                            const daysLeft = 5 - daysOld;
                            if (daysLeft <= 2 && daysLeft > 0) {
                              return (
                                <span className="text-orange-400">
                                  • Deletes in {daysLeft}d
                                </span>
                              );
                            } else if (daysLeft <= 0) {
                              return (
                                <span className="text-red-400">
                                  • Archiving soon
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteClick(conversation.id, conversation.title, e)}
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-rh-card border-2 border-red-500/30 rounded-xl max-w-md w-full shadow-2xl animate-scale-in">
            {/* Header with warning icon */}
            <div className="flex items-start gap-4 p-6 border-b border-rh-border">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-rh-text mb-1">
                  Delete Conversation?
                </h3>
                <p className="text-sm text-rh-text-muted">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-rh-darker border border-rh-border rounded-lg p-4 mb-4">
                <p className="text-xs text-rh-text-muted mb-1">Conversation title:</p>
                <p className="text-sm font-medium text-rh-text">
                  {confirmDeleteTitle}
                </p>
              </div>
              <p className="text-sm text-rh-text-muted">
                All messages in this conversation will be permanently deleted.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-rh-border bg-rh-darker/50">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium text-rh-text bg-rh-dark border border-rh-border rounded-lg hover:bg-rh-darker transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingId === confirmDeleteId}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingId === confirmDeleteId ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Conversation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-rh-card border-2 border-red-500/30 rounded-xl max-w-md w-full shadow-2xl animate-scale-in">
            {/* Header with warning icon */}
            <div className="flex items-start gap-4 p-6 border-b border-rh-border">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-rh-text mb-1">
                  Delete All Conversations?
                </h3>
                <p className="text-sm text-rh-text-muted">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-rh-darker border border-rh-border rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-rh-text mb-2">
                  You are about to delete <span className="font-bold text-red-400">{conversations.length}</span> conversations:
                </p>
                <ul className="text-xs text-rh-text-muted space-y-1 max-h-32 overflow-y-auto">
                  {conversations.slice(0, 5).map((conv, idx) => (
                    <li key={conv.id}>• {conv.title}</li>
                  ))}
                  {conversations.length > 5 && (
                    <li className="text-rh-text-secondary italic">... and {conversations.length - 5} more</li>
                  )}
                </ul>
              </div>
              <p className="text-sm text-rh-text-muted">
                All messages in all conversations will be permanently deleted. A new empty conversation will be created.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-rh-border bg-rh-darker/50">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                disabled={isDeletingAll}
                className="px-4 py-2 text-sm font-medium text-rh-text bg-rh-dark border border-rh-border rounded-lg hover:bg-rh-darker transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeletingAll ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting All...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete All ({conversations.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
