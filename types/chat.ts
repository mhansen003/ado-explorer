/**
 * Chat and Conversation Types
 * For Redis-backed conversational AI feature
 */

export interface ADOCollection {
  type: 'projects' | 'teams' | 'users' | 'states' | 'types' | 'tags' | 'work_items';
  data: any[];
  count: number;
  query?: string; // The query that was used to fetch this data
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount?: number;
  metadata?: Record<string, any>;
  collections?: ADOCollection[]; // Support for ADO collections returned by MCP tools
  suggestions?: string[]; // AI-generated follow-up suggestions
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
  type: 'token' | 'done' | 'error' | 'tool_use' | 'tool_result' | 'suggestions';
  content?: string;
  messageId?: string;
  userMessageId?: string;
  error?: string;
  toolName?: string;
  toolInput?: any;
  toolResult?: any;
  collections?: ADOCollection[];
  suggestions?: string[];
}
