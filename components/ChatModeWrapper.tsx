'use client';

/**
 * Chat Mode Wrapper
 * Allows switching between Quick Search mode and Conversations mode
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import ChatInterface from './ChatInterface';
import ConversationalChat from './ConversationalChat';

type ChatMode = 'quick' | 'conversations';

export default function ChatModeWrapper() {
  const [mode, setMode] = useState<ChatMode>('quick');

  // Load mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('ado-chat-mode') as ChatMode;
    if (savedMode === 'conversations' || savedMode === 'quick') {
      setMode(savedMode);
    }
  }, []);

  const handleModeChange = (newMode: ChatMode) => {
    setMode(newMode);
    localStorage.setItem('ado-chat-mode', newMode);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 px-4 py-2 bg-rh-card border-b border-rh-border">
        <button
          onClick={() => handleModeChange('quick')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            mode === 'quick'
              ? 'bg-rh-green text-white'
              : 'bg-rh-dark text-rh-text-muted hover:text-rh-text hover:bg-rh-darker'
          }`}
        >
          <Search className="w-4 h-4" />
          <span className="font-medium">Quick Search</span>
        </button>

        <button
          onClick={() => handleModeChange('conversations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            mode === 'conversations'
              ? 'bg-rh-green text-white'
              : 'bg-rh-dark text-rh-text-muted hover:text-rh-text hover:bg-rh-darker'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="font-medium">Conversations</span>
        </button>

        <div className="ml-auto text-xs text-rh-text-muted">
          {mode === 'quick' && 'Fast searches with slash commands'}
          {mode === 'conversations' && 'Contextual AI conversations with memory'}
        </div>
      </div>

      {/* Render appropriate interface */}
      {mode === 'quick' && <ChatInterface />}
      {mode === 'conversations' && <ConversationalChat />}
    </div>
  );
}
