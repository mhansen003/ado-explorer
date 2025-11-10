/**
 * Conversation Context Manager
 *
 * Manages conversation history for the AI orchestrator.
 * Keeps track of the last 7-10 turns for context continuity.
 */

import { ConversationContext, ConversationTurn, Intent, OrchestratedResponse } from '../types/ai-types';
import { WorkItem, GlobalFilters } from '@/types';
import { CacheService } from '../redis/cacheService';
import { v4 as uuidv4 } from 'uuid';

const MAX_TURNS = 10;
const MIN_TURNS = 7;
const CONTEXT_TTL = 3600; // 1 hour in seconds

export class ContextManager {
  private cache: CacheService;
  private memoryCache: Map<string, ConversationContext>; // Fallback when Redis unavailable

  constructor() {
    this.cache = new CacheService();
    this.memoryCache = new Map();
  }

  /**
   * Create a new conversation context
   */
  async createContext(
    userId: string,
    filters?: GlobalFilters
  ): Promise<ConversationContext> {
    const context: ConversationContext = {
      conversationId: uuidv4(),
      userId,
      turns: [],
      globalFilters: filters,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.saveContext(context);
    return context;
  }

  /**
   * Get conversation context by ID
   */
  async getContext(conversationId: string): Promise<ConversationContext | null> {
    // Try Redis first
    const key = this.getContextKey(conversationId);
    const cached = await this.cache.get<ConversationContext>(key);
    if (cached) {
      return cached;
    }

    // Fall back to memory cache
    return this.memoryCache.get(conversationId) || null;
  }

  /**
   * Add a turn to the conversation
   */
  async addTurn(
    conversationId: string,
    userQuery: string,
    intent: Intent,
    response: OrchestratedResponse,
    workItems?: WorkItem[]
  ): Promise<ConversationContext> {
    const context = await this.getContext(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }

    const turn: ConversationTurn = {
      id: uuidv4(),
      timestamp: new Date(),
      userQuery,
      intent,
      response,
      workItems,
    };

    context.turns.push(turn);
    context.updatedAt = new Date();

    // Keep only last MAX_TURNS
    if (context.turns.length > MAX_TURNS) {
      context.turns = context.turns.slice(-MAX_TURNS);
    }

    await this.saveContext(context);
    return context;
  }

  /**
   * Get recent turns for context
   */
  getRecentTurns(context: ConversationContext, count?: number): ConversationTurn[] {
    const numTurns = count || MIN_TURNS;
    return context.turns.slice(-numTurns);
  }

  /**
   * Get work items from recent turns (for context)
   */
  getRecentWorkItems(context: ConversationContext, maxItems: number = 50): WorkItem[] {
    const items: WorkItem[] = [];
    const seenIds = new Set<string>();

    // Go through turns in reverse (most recent first)
    for (let i = context.turns.length - 1; i >= 0 && items.length < maxItems; i--) {
      const turn = context.turns[i];
      if (turn.workItems) {
        for (const item of turn.workItems) {
          if (!seenIds.has(item.id) && items.length < maxItems) {
            items.push(item);
            seenIds.add(item.id);
          }
        }
      }
    }

    return items;
  }

  /**
   * Find similar past queries
   */
  findSimilarQueries(
    context: ConversationContext,
    currentIntent: Intent
  ): ConversationTurn[] {
    return context.turns.filter((turn) => {
      return (
        turn.intent.type === currentIntent.type &&
        turn.intent.scope === currentIntent.scope
      );
    });
  }

  /**
   * Check if we've recently queried similar data
   */
  hasRecentSimilarQuery(
    context: ConversationContext,
    currentIntent: Intent,
    withinMinutes: number = 5
  ): boolean {
    const cutoffTime = new Date(Date.now() - withinMinutes * 60 * 1000);

    return context.turns.some((turn) => {
      if (new Date(turn.timestamp) < cutoffTime) {
        return false;
      }

      // Check if intents are similar
      return (
        turn.intent.type === currentIntent.type &&
        turn.intent.scope === currentIntent.scope &&
        turn.intent.issueId === currentIntent.issueId &&
        turn.intent.userIdentifier === currentIntent.userIdentifier &&
        turn.intent.sprintIdentifier === currentIntent.sprintIdentifier
      );
    });
  }

  /**
   * Extract recently mentioned entities from conversation history
   */
  getRecentEntities(context: ConversationContext, maxTurns: number = 5): {
    projects: string[];
    users: string[];
    sprints: string[];
    teams: string[];
    lastMentionedUser?: string;
  } {
    const recentTurns = this.getRecentTurns(context, maxTurns);
    const entities = {
      projects: [] as string[],
      users: [] as string[],
      sprints: [] as string[],
      teams: [] as string[],
      lastMentionedUser: undefined as string | undefined,
    };

    for (const turn of recentTurns) {
      // Extract from intent
      if (turn.intent.projectIdentifier) {
        entities.projects.push(turn.intent.projectIdentifier);
      }
      if (turn.intent.userIdentifier) {
        entities.users.push(turn.intent.userIdentifier);
        // Track the most recently mentioned user for pronoun resolution
        entities.lastMentionedUser = turn.intent.userIdentifier;
      }
      if (turn.intent.sprintIdentifier) {
        entities.sprints.push(turn.intent.sprintIdentifier);
      }
      if (turn.intent.teamIdentifier) {
        entities.teams.push(turn.intent.teamIdentifier);
      }

      // Extract from work items (project names)
      if (turn.workItems) {
        for (const item of turn.workItems.slice(0, 10)) { // Sample first 10
          if (item.project && !entities.projects.includes(item.project)) {
            entities.projects.push(item.project);
          }
        }
      }

      // Extract from response metadata (list of projects, if available)
      const metadata = turn.response.metadata as any;
      if (metadata?.projects && Array.isArray(metadata.projects)) {
        const projects = metadata.projects as Array<{name: string}>;
        for (const proj of projects.slice(0, 10)) {
          if (proj.name && !entities.projects.includes(proj.name)) {
            entities.projects.push(proj.name);
          }
        }
      }
    }

    // Deduplicate and return most recent
    return {
      projects: [...new Set(entities.projects)].slice(-10),
      users: [...new Set(entities.users)].slice(-10),
      sprints: [...new Set(entities.sprints)].slice(-10),
      teams: [...new Set(entities.teams)].slice(-10),
      lastMentionedUser: entities.lastMentionedUser,
    };
  }

  /**
   * Get summary of conversation for AI context
   */
  getConversationSummary(context: ConversationContext): string {
    if (context.turns.length === 0) {
      return 'New conversation - no previous context.';
    }

    const recentTurns = this.getRecentTurns(context, 5);
    const summary = recentTurns
      .map((turn, index) => {
        return `Turn ${index + 1}: User asked "${turn.userQuery}" (${turn.intent.type}, ${turn.intent.scope})`;
      })
      .join('\n');

    return `Conversation history (last ${recentTurns.length} turns):\n${summary}`;
  }

  /**
   * Update global filters for conversation
   */
  async updateFilters(
    conversationId: string,
    filters: GlobalFilters
  ): Promise<ConversationContext> {
    const context = await this.getContext(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }

    context.globalFilters = filters;
    context.updatedAt = new Date();

    await this.saveContext(context);
    return context;
  }

  /**
   * Clear old turns (keep only recent N)
   */
  async pruneContext(
    conversationId: string,
    keepTurns: number = MIN_TURNS
  ): Promise<ConversationContext> {
    const context = await this.getContext(conversationId);
    if (!context) {
      throw new Error('Conversation not found');
    }

    if (context.turns.length > keepTurns) {
      context.turns = context.turns.slice(-keepTurns);
      context.updatedAt = new Date();
      await this.saveContext(context);
    }

    return context;
  }

  /**
   * Delete conversation context
   */
  async deleteContext(conversationId: string): Promise<void> {
    // Delete from Redis
    const key = this.getContextKey(conversationId);
    await this.cache.delete(key);

    // Delete from memory cache
    this.memoryCache.delete(conversationId);
  }

  /**
   * Save context to cache (Redis + memory fallback)
   */
  private async saveContext(context: ConversationContext): Promise<void> {
    // Try to save to Redis
    const key = this.getContextKey(context.conversationId);
    await this.cache.set(key, context, CONTEXT_TTL);

    // Always save to memory cache as fallback
    this.memoryCache.set(context.conversationId, context);
  }

  /**
   * Generate cache key for context
   */
  private getContextKey(conversationId: string): string {
    return `ado:context:${conversationId}`;
  }

  /**
   * Get context statistics
   */
  getStats(context: ConversationContext): {
    totalTurns: number;
    totalWorkItems: number;
    avgResponseTime: number;
    cacheHitRate: number;
  } {
    const totalTurns = context.turns.length;
    const totalWorkItems = context.turns.reduce(
      (sum, turn) => sum + (turn.workItems?.length || 0),
      0
    );

    const avgResponseTime =
      totalTurns > 0
        ? context.turns.reduce((sum, turn) => sum + turn.response.metadata.processingTime, 0) /
          totalTurns
        : 0;

    const cacheHits = context.turns.filter((turn) => turn.response.metadata.cacheHit).length;
    const cacheHitRate = totalTurns > 0 ? cacheHits / totalTurns : 0;

    return {
      totalTurns,
      totalWorkItems,
      avgResponseTime,
      cacheHitRate,
    };
  }

  /**
   * Export context for debugging
   */
  exportContext(context: ConversationContext): any {
    return {
      conversationId: context.conversationId,
      userId: context.userId,
      turnCount: context.turns.length,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      filters: context.globalFilters,
      turns: context.turns.map((turn) => ({
        id: turn.id,
        timestamp: turn.timestamp,
        query: turn.userQuery,
        intentType: turn.intent.type,
        intentScope: turn.intent.scope,
        workItemCount: turn.workItems?.length || 0,
        confidence: turn.response.metadata.confidence,
      })),
    };
  }
}

export default ContextManager;
