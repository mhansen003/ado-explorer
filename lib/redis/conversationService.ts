/**
 * Redis Conversation Service
 * Handles conversation and message storage/retrieval
 */

import { RedisClientType } from 'redis';
import { Conversation, Message, ConversationSummary } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

export class ConversationService {
  private redis: RedisClientType;

  constructor(redis: RedisClientType) {
    this.redis = redis;
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    userId: string,
    title: string = 'New Conversation',
    model: string = 'claude-sonnet-4-5-20250929',
    systemPrompt?: string
  ): Promise<Conversation> {
    // Default to ADO-aware system prompt if none provided
    const defaultSystemPrompt = `You are an AI assistant integrated with Azure DevOps. Your role is to help users explore and understand their Azure DevOps projects, work items, teams, and more.

## Collection Data Format

When users ask about Azure DevOps collections (projects, teams, users, states, types, tags), the system will automatically fetch the data and provide it to you in this format:

<collection_data type="projects|teams|users|states|types|tags" count="N">
[Structured data here]
</collection_data>

## Your Response Guidelines

When you receive collection_data:
1. **Format as a beautiful markdown table or list**
2. **Add helpful context** - explain what the data means
3. **Provide insights** - notice patterns, highlight important items
4. **Suggest next steps** - what can the user do next?

Always present results in well-formatted markdown with:
- **Bold** for important items
- Tables for structured data (projects, teams, users)
- Bullet lists for simple lists
- Helpful context and next steps

Format your responses to be clear and actionable.`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;
    const conversationId = uuidv4();
    const now = Date.now();

    const conversation: Conversation = {
      id: conversationId,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      model,
      totalTokens: 0,
      metadata: { systemPrompt: finalSystemPrompt },
    };

    // Store conversation metadata in hash
    await this.redis.hSet(
      `conversation:${conversationId}`,
      this.conversationToHash(conversation)
    );

    // Add to user's conversation list (sorted set by updatedAt)
    await this.redis.zAdd(`user:${userId}:conversations`, {
      score: now,
      value: conversationId,
    });

    // Set TTL: 30 days for active conversations
    await this.redis.expire(`conversation:${conversationId}`, 60 * 60 * 24 * 30);

    console.log('[Conversation Service] Created conversation:', conversationId);
    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation | null> {
    const data = await this.redis.hGetAll(`conversation:${conversationId}`);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return this.hashToConversation(data);
  }

  /**
   * Update conversation metadata
   */
  async updateConversation(
    conversationId: string,
    updates: Partial<Conversation>
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const updatedConversation = {
      ...conversation,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.redis.hSet(
      `conversation:${conversationId}`,
      this.conversationToHash(updatedConversation)
    );

    // Update sorted set score
    await this.redis.zAdd(`user:${conversation.userId}:conversations`, {
      score: updatedConversation.updatedAt,
      value: conversationId,
    });

    // Extend TTL on update
    await this.redis.expire(`conversation:${conversationId}`, 60 * 60 * 24 * 30);
  }

  /**
   * Delete conversation and all its messages
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      return;
    }

    // Delete conversation metadata
    await this.redis.del(`conversation:${conversationId}`);

    // Delete messages
    await this.redis.del(`conversation:${conversationId}:messages`);

    // Remove from user's conversation list
    await this.redis.zRem(`user:${conversation.userId}:conversations`, conversationId);

    console.log('[Conversation Service] Deleted conversation:', conversationId);
  }

  /**
   * Add a message to conversation
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    tokenCount?: number
  ): Promise<Message> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const messageId = uuidv4();
    const timestamp = Date.now();

    const message: Message = {
      id: messageId,
      role,
      content,
      timestamp,
      tokenCount,
    };

    // Add to sorted set (sorted by timestamp)
    await this.redis.zAdd(`conversation:${conversationId}:messages`, {
      score: timestamp,
      value: JSON.stringify(message),
    });

    // Update conversation metadata
    const newMessageCount = conversation.messageCount + 1;
    const newTotalTokens = conversation.totalTokens + (tokenCount || 0);
    const lastMessagePreview = content.substring(0, 100);

    await this.updateConversation(conversationId, {
      messageCount: newMessageCount,
      totalTokens: newTotalTokens,
      lastMessagePreview,
    });

    console.log('[Conversation Service] Added message to', conversationId);
    return message;
  }

  /**
   * Get messages for a conversation
   * @param limit - Maximum number of messages to retrieve (default: 50)
   * @param offset - Number of messages to skip from the end (default: 0)
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    // Get messages in reverse chronological order, then reverse
    const messages = await this.redis.zRange(
      `conversation:${conversationId}:messages`,
      -limit - offset,
      -1 - offset
    );

    return messages.map(msg => JSON.parse(msg));
  }

  /**
   * Get recent messages for context window
   * Implements sliding window approach
   */
  async getRecentMessagesForContext(
    conversationId: string,
    maxTokens: number = 160000, // Claude Sonnet 4 limit
    targetPercentage: number = 0.8 // Use 80% of limit
  ): Promise<Message[]> {
    const targetTokens = maxTokens * targetPercentage;
    const allMessages = await this.getMessages(conversationId, 100); // Get up to 100 recent

    let currentTokens = 0;
    const contextMessages: Message[] = [];

    // Start from most recent, add until we hit token limit
    // Always keep minimum 10-15 messages
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const message = allMessages[i];
      const messageTokens = message.tokenCount || this.estimateTokens(message.content);

      if (currentTokens + messageTokens > targetTokens && contextMessages.length >= 10) {
        break;
      }

      contextMessages.unshift(message);
      currentTokens += messageTokens;
    }

    console.log(
      '[Conversation Service] Context window:',
      contextMessages.length,
      'messages,',
      currentTokens,
      'tokens'
    );

    return contextMessages;
  }

  /**
   * List user's conversations
   */
  async listUserConversations(
    userId: string,
    limit: number = 50
  ): Promise<ConversationSummary[]> {
    // Get conversation IDs sorted by most recent
    const conversationIds = await this.redis.zRange(
      `user:${userId}:conversations`,
      -limit,
      -1,
      { REV: true }
    );

    const summaries: ConversationSummary[] = [];

    for (const id of conversationIds) {
      const conversation = await this.getConversation(id);
      if (conversation) {
        summaries.push({
          id: conversation.id,
          title: conversation.title,
          updatedAt: conversation.updatedAt,
          messageCount: conversation.messageCount,
          lastMessagePreview: conversation.lastMessagePreview,
        });
      }
    }

    return summaries;
  }

  /**
   * Generate conversation title from messages
   */
  async generateTitle(conversationId: string): Promise<string> {
    const messages = await this.getMessages(conversationId, 5);

    // Get first user message for title generation
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return 'New Conversation';
    }

    // Simple title extraction (first 50 chars of first message)
    // TODO: Use Haiku model for better title generation
    const content = firstUserMessage.content;
    if (content.length <= 50) {
      return content;
    }

    return content.substring(0, 47) + '...';
  }

  /**
   * Cleanup inactive conversations (called by cron job)
   */
  async cleanupInactiveConversations(daysInactive: number = 7): Promise<number> {
    const cutoffTime = Date.now() - daysInactive * 24 * 60 * 60 * 1000;
    let deleted = 0;

    // This would need to iterate through all user conversation sets
    // For now, we rely on Redis TTL expiration

    return deleted;
  }

  // Helper methods

  private conversationToHash(conversation: Conversation): Record<string, string> {
    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt.toString(),
      updatedAt: conversation.updatedAt.toString(),
      messageCount: conversation.messageCount.toString(),
      model: conversation.model,
      totalTokens: conversation.totalTokens.toString(),
      lastMessagePreview: conversation.lastMessagePreview || '',
      metadata: JSON.stringify(conversation.metadata || {}),
    };
  }

  private hashToConversation(data: Record<string, string>): Conversation {
    return {
      id: data.id,
      userId: data.userId,
      title: data.title,
      createdAt: parseInt(data.createdAt),
      updatedAt: parseInt(data.updatedAt),
      messageCount: parseInt(data.messageCount),
      model: data.model,
      totalTokens: parseInt(data.totalTokens),
      lastMessagePreview: data.lastMessagePreview || undefined,
      metadata: data.metadata ? JSON.parse(data.metadata) : {},
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
