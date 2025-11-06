/**
 * Chat and Conversation Types
 * For Redis-backed conversational AI feature
 */

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount?: number;
  metadata?: Record<string, any>;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model: string;
  totalTokens: number;
  lastMessagePreview?: string;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  lastMessagePreview?: string;
}

export interface CreateConversationRequest {
  title?: string;
  model?: string;
  systemPrompt?: string;
}

export interface SendMessageRequest {
  content: string;
  model?: string;
}

export interface ConversationContext {
  conversationId: string;
  messages: Message[];
  totalTokens: number;
  model: string;
}

export interface StreamingResponse {
  type: 'token' | 'done' | 'error';
  content?: string;
  messageId?: string;
  error?: string;
}
