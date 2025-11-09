/**
 * Intent Analyzer
 *
 * Phase 1 of the AI Orchestrator pipeline.
 * Analyzes user queries and classifies them into actionable intents.
 */

import OpenAI from 'openai';
import {
  Intent,
  IntentType,
  IntentScope,
  IntentComplexity,
} from '../types/ai-types';
import {
  INTENT_ANALYSIS_SYSTEM_PROMPT,
  buildIntentAnalysisPrompt,
} from '../ai-prompts/intent-prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class IntentAnalyzer {
  private model: string;

  constructor(model: string = 'gpt-4o-mini') {
    this.model = model;
  }

  /**
   * Analyze a user query and extract intent
   */
  async analyze(userQuery: string): Promise<Intent> {
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: INTENT_ANALYSIS_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildIntentAnalysisPrompt(userQuery),
          },
        ],
        temperature: 0.3, // Low temperature for consistent classification
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);

      // Validate and return intent
      return this.validateIntent(parsed);
    } catch (error) {
      console.error('Error analyzing intent:', error);

      // Fallback: Return a basic intent
      return this.createFallbackIntent(userQuery);
    }
  }

  /**
   * Validate the AI response and ensure it matches our type structure
   */
  private validateIntent(parsed: any): Intent {
    // Ensure required fields exist
    const intent: Intent = {
      type: this.validateType(parsed.type),
      scope: this.validateScope(parsed.scope),
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      dataRequired: Boolean(parsed.dataRequired),
      complexity: this.validateComplexity(parsed.complexity),
      confidence: this.normalizeConfidence(parsed.confidence),
      originalQuery: parsed.originalQuery || '',
    };

    // Add optional fields
    if (parsed.sprintIdentifier) {
      intent.sprintIdentifier = parsed.sprintIdentifier;
    }
    if (parsed.userIdentifier) {
      intent.userIdentifier = parsed.userIdentifier;
    }
    if (parsed.issueId) {
      intent.issueId = parseInt(parsed.issueId, 10);
    }
    if (parsed.projectIdentifier) {
      intent.projectIdentifier = parsed.projectIdentifier;
    }
    if (parsed.dateRange) {
      intent.dateRange = parsed.dateRange;
    }
    if (parsed.teamIdentifier) {
      intent.teamIdentifier = parsed.teamIdentifier;
    }
    if (parsed.boardIdentifier) {
      intent.boardIdentifier = parsed.boardIdentifier;
    }
    if (parsed.tags) {
      intent.tags = parsed.tags;
    }
    if (parsed.states) {
      intent.states = parsed.states;
    }
    if (parsed.types) {
      intent.types = parsed.types;
    }

    return intent;
  }

  /**
   * Validate intent type
   */
  private validateType(type: string): IntentType {
    const validTypes: IntentType[] = ['QUESTION', 'COMMAND', 'ANALYSIS', 'SUMMARY'];
    return validTypes.includes(type as IntentType) ? (type as IntentType) : 'COMMAND';
  }

  /**
   * Validate intent scope
   */
  private validateScope(scope: string): IntentScope {
    const validScopes: IntentScope[] = [
      'SPRINT',
      'USER',
      'PROJECT',
      'ISSUE',
      'TEAM',
      'BOARD',
      'QUERY',
      'STATE',
      'TYPE',
      'TAG',
      'PRIORITY',
      'TITLE',
      'DESCRIPTION',
      'DATE_RANGE',
      'ASSIGNEE',
      'CREATOR',
      'ITERATION',
      'AREA',
      'RELATION',
      'GLOBAL',
    ];
    return validScopes.includes(scope as IntentScope) ? (scope as IntentScope) : 'GLOBAL';
  }

  /**
   * Validate complexity
   */
  private validateComplexity(complexity: string): IntentComplexity {
    const validComplexity: IntentComplexity[] = ['SIMPLE', 'MULTI_STEP', 'ANALYTICAL'];
    return validComplexity.includes(complexity as IntentComplexity)
      ? (complexity as IntentComplexity)
      : 'SIMPLE';
  }

  /**
   * Normalize confidence to 0-1 range
   */
  private normalizeConfidence(confidence: any): number {
    const conf = parseFloat(confidence);
    if (isNaN(conf)) return 0.5;
    return Math.max(0, Math.min(1, conf));
  }

  /**
   * Create a fallback intent when AI fails
   */
  private createFallbackIntent(userQuery: string): Intent {
    // Simple heuristics for fallback
    const lowerQuery = userQuery.toLowerCase();

    let type: IntentType = 'COMMAND';
    let scope: IntentScope = 'GLOBAL';
    let dataRequired = true;
    let complexity: IntentComplexity = 'SIMPLE';

    // Detect question
    if (
      lowerQuery.startsWith('what') ||
      lowerQuery.startsWith('how') ||
      lowerQuery.startsWith('why') ||
      lowerQuery.includes('?')
    ) {
      type = 'QUESTION';
    }

    // Detect analysis
    if (
      lowerQuery.includes('why') ||
      lowerQuery.includes('analyze') ||
      lowerQuery.includes('compare')
    ) {
      type = 'ANALYSIS';
      complexity = 'ANALYTICAL';
    }

    // Detect summary
    if (lowerQuery.includes('summar') || lowerQuery.includes('overview')) {
      type = 'SUMMARY';
      complexity = 'MULTI_STEP';
    }

    // Detect scope
    if (lowerQuery.includes('sprint')) scope = 'SPRINT';
    else if (lowerQuery.match(/\b\d+\b/)) scope = 'ISSUE';
    else if (lowerQuery.includes('project')) scope = 'PROJECT';
    else if (lowerQuery.includes('team')) scope = 'TEAM';

    // Check if data required
    const generalQuestions = ['what is', 'how do', 'can you', 'help'];
    dataRequired = !generalQuestions.some((q) => lowerQuery.includes(q));

    return {
      type,
      scope,
      entities: [],
      dataRequired,
      complexity,
      confidence: 0.5, // Low confidence for fallback
      originalQuery: userQuery,
    };
  }

  /**
   * Check if a query is a slash command (fast-path detection)
   */
  static isSlashCommand(query: string): boolean {
    return query.trim().startsWith('/');
  }

  /**
   * Parse a slash command into an intent (fast-path, no AI needed)
   */
  static parseSlashCommand(query: string): Intent {
    const parts = query.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const param = parts.slice(1).join(' ');

    const intent: Intent = {
      type: 'COMMAND',
      scope: 'GLOBAL',
      entities: [command, param].filter(Boolean),
      dataRequired: true,
      complexity: 'SIMPLE',
      confidence: 1.0,
      originalQuery: query,
    };

    // Map command to scope and add identifiers
    switch (command) {
      case '/sprint':
      case '/current-sprint':
        intent.scope = 'SPRINT';
        intent.sprintIdentifier = param || 'current';
        break;

      case '/assigned_to':
      case '/created_by':
        intent.scope = 'USER';
        intent.userIdentifier = param;
        break;

      case '/state':
        intent.states = [param];
        break;

      case '/type':
        intent.types = [param];
        break;

      case '/tag':
        intent.scope = 'TAG';
        intent.tags = [param];
        break;

      case '/board':
        intent.scope = 'BOARD';
        intent.boardIdentifier = param;
        break;

      case '/team':
        intent.scope = 'TEAM';
        intent.teamIdentifier = param;
        break;

      default:
        intent.scope = 'GLOBAL';
    }

    return intent;
  }
}

export default IntentAnalyzer;
