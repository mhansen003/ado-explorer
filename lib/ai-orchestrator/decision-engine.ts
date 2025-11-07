/**
 * Decision Engine
 *
 * Phase 2 of the AI Orchestrator pipeline.
 * Decides whether ADO data is needed and what queries/analysis to perform.
 */

import OpenAI from 'openai';
import { Intent, Decision, ConversationContext, QueryType } from '../types/ai-types';
import {
  DECISION_ENGINE_SYSTEM_PROMPT,
  buildDecisionPrompt,
} from '../ai-prompts/decision-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class DecisionEngine {
  private model: string;

  constructor(model: string = 'gpt-4o-mini') {
    this.model = model;
  }

  /**
   * Decide what data and analysis is needed for the given intent
   */
  async decide(
    intent: Intent,
    conversationContext?: ConversationContext
  ): Promise<Decision> {
    try {
      // Quick decision for obvious cases (no AI needed)
      const quickDecision = this.quickDecision(intent, conversationContext);
      if (quickDecision) {
        return quickDecision;
      }

      // Use AI for complex decision-making
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: DECISION_ENGINE_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildDecisionPrompt(intent, conversationContext),
          },
        ],
        temperature: 0.2, // Low temperature for consistent decisions
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return this.validateDecision(parsed);
    } catch (error) {
      console.error('Error in decision engine:', error);

      // Fallback: Conservative decision (assume we need data)
      return this.createFallbackDecision(intent);
    }
  }

  /**
   * Make quick decisions for obvious cases without AI
   */
  private quickDecision(
    intent: Intent,
    conversationContext?: ConversationContext
  ): Decision | null {
    // Case 1: General questions don't need ADO data
    if (intent.type === 'QUESTION' && intent.scope === 'GLOBAL' && !intent.dataRequired) {
      return {
        requiresADO: false,
        queriesNeeded: [],
        analysisRequired: [],
        canUseCache: false,
        estimatedComplexity: 1,
        reasoning: 'General knowledge question - no ADO data needed',
      };
    }

    // Case 2: Specific issue by ID - simple WIQL query
    if (intent.scope === 'ISSUE' && intent.issueId) {
      return {
        requiresADO: true,
        queriesNeeded: ['WIQL'],
        analysisRequired: [],
        canUseCache: true,
        cacheKey: `issue:${intent.issueId}`,
        estimatedComplexity: 2,
        reasoning: 'Single item lookup by ID',
      };
    }

    // Case 3: Simple user query
    if (
      intent.type === 'COMMAND' &&
      intent.scope === 'USER' &&
      intent.complexity === 'SIMPLE'
    ) {
      return {
        requiresADO: true,
        queriesNeeded: ['WIQL'],
        analysisRequired: [],
        canUseCache: true,
        cacheKey: `user:${intent.userIdentifier}:${intent.states?.join(',')}`,
        estimatedComplexity: 3,
        reasoning: 'Simple user query - basic WIQL',
      };
    }

    // No quick decision - use AI
    return null;
  }

  /**
   * Validate the AI decision response
   */
  private validateDecision(parsed: any): Decision {
    const decision: Decision = {
      requiresADO: Boolean(parsed.requiresADO),
      queriesNeeded: this.validateQueryTypes(parsed.queriesNeeded),
      analysisRequired: Array.isArray(parsed.analysisRequired)
        ? parsed.analysisRequired
        : [],
      canUseCache: Boolean(parsed.canUseCache),
      estimatedComplexity: this.normalizeComplexity(parsed.estimatedComplexity),
      reasoning: parsed.reasoning || 'Decision made by AI',
    };

    if (parsed.cacheKey && decision.canUseCache) {
      decision.cacheKey = this.sanitizeCacheKey(parsed.cacheKey);
    }

    return decision;
  }

  /**
   * Validate query types
   */
  private validateQueryTypes(types: any): QueryType[] {
    if (!Array.isArray(types)) return [];

    const validTypes: QueryType[] = ['WIQL', 'REST', 'METADATA'];
    return types.filter((t) => validTypes.includes(t as QueryType)) as QueryType[];
  }

  /**
   * Normalize complexity to 1-10 range
   */
  private normalizeComplexity(complexity: any): number {
    const comp = parseInt(complexity, 10);
    if (isNaN(comp)) return 5;
    return Math.max(1, Math.min(10, comp));
  }

  /**
   * Sanitize cache key
   */
  private sanitizeCacheKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9:_-]/g, '_').toLowerCase();
  }

  /**
   * Create fallback decision when AI fails
   */
  private createFallbackDecision(intent: Intent): Decision {
    // Conservative: assume we need ADO data unless it's clearly a question
    const requiresADO = intent.dataRequired || intent.type !== 'QUESTION';

    const queriesNeeded: QueryType[] = requiresADO ? ['WIQL'] : [];

    // Determine analysis based on intent type
    const analysisRequired: string[] = [];
    if (intent.type === 'ANALYSIS') {
      analysisRequired.push('status_distribution');
      if (intent.scope === 'SPRINT') {
        analysisRequired.push('velocity', 'blockers');
      }
    }

    return {
      requiresADO,
      queriesNeeded,
      analysisRequired,
      canUseCache: true,
      estimatedComplexity: intent.complexity === 'SIMPLE' ? 3 : 7,
      reasoning: 'Fallback decision - conservative approach',
    };
  }

  /**
   * Check if we can use cached data from conversation context
   */
  canUseCachedData(
    intent: Intent,
    conversationContext?: ConversationContext,
    cacheTTL: number = 300000 // 5 minutes
  ): boolean {
    if (!conversationContext || !conversationContext.turns.length) {
      return false;
    }

    // Look for recent similar queries
    const now = Date.now();
    const recentTurn = conversationContext.turns.find((turn) => {
      const age = now - new Date(turn.timestamp).getTime();
      const isSimilar = this.areSimilarIntents(intent, turn.intent);
      return isSimilar && age < cacheTTL;
    });

    return !!recentTurn;
  }

  /**
   * Check if two intents are similar (for cache matching)
   */
  private areSimilarIntents(intent1: Intent, intent2: Intent): boolean {
    if (intent1.type !== intent2.type) return false;
    if (intent1.scope !== intent2.scope) return false;

    // Check specific identifiers
    if (intent1.issueId && intent2.issueId) {
      return intent1.issueId === intent2.issueId;
    }

    if (intent1.userIdentifier && intent2.userIdentifier) {
      return (
        intent1.userIdentifier.toLowerCase() === intent2.userIdentifier.toLowerCase()
      );
    }

    if (intent1.sprintIdentifier && intent2.sprintIdentifier) {
      return (
        intent1.sprintIdentifier.toLowerCase() === intent2.sprintIdentifier.toLowerCase()
      );
    }

    // Check if states and types match
    const states1 = (intent1.states || []).sort().join(',');
    const states2 = (intent2.states || []).sort().join(',');
    if (states1 !== states2) return false;

    const types1 = (intent1.types || []).sort().join(',');
    const types2 = (intent2.types || []).sort().join(',');
    if (types1 !== types2) return false;

    return true;
  }

  /**
   * Generate a cache key for an intent
   */
  static generateCacheKey(intent: Intent): string {
    const parts: string[] = [
      intent.type,
      intent.scope,
      intent.issueId?.toString() || '',
      intent.userIdentifier || '',
      intent.projectIdentifier || '',
      intent.sprintIdentifier || '',
      intent.teamIdentifier || '',
      intent.boardIdentifier || '',
      (intent.states || []).sort().join(','),
      (intent.types || []).sort().join(','),
      (intent.tags || []).sort().join(','),
    ];

    return parts
      .filter(Boolean)
      .join(':')
      .replace(/[^a-zA-Z0-9:_-]/g, '_')
      .toLowerCase();
  }
}

export default DecisionEngine;
