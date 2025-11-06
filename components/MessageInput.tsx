'use client';

/**
 * Message Input Component
 * Textarea with auto-resize and send functionality
 */

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Send, StopCircle } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onStopStreaming?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSendMessage,
  onStopStreaming,
  isStreaming = false,
  disabled = false,
  placeholder = 'Ask about work items, sprints, or project status...',
}: MessageInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!input.trim() || disabled || isStreaming) {
      return;
    }

    onSendMessage(input.trim());
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="border-t border-rh-border bg-rh-card p-4">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isStreaming}
            rows={1}
            className="flex-1 bg-rh-dark border border-rh-border rounded-lg px-4 py-3 text-rh-text placeholder-rh-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-rh-green focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              minHeight: '48px',
              maxHeight: '200px',
            }}
          />

          {isStreaming ? (
            <button
              onClick={onStopStreaming}
              className="flex-shrink-0 p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              title="Stop generating"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
              className="flex-shrink-0 p-3 bg-rh-green hover:bg-rh-green-hover text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message (Enter)"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="mt-2 text-xs text-rh-text-muted text-center">
          Press <kbd className="px-1.5 py-0.5 bg-rh-dark border border-rh-border rounded">Enter</kbd> to send,
          <kbd className="px-1.5 py-0.5 bg-rh-dark border border-rh-border rounded ml-1">Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}
