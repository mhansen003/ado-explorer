/**
 * Result Evaluator
 *
 * Phase 5 of the AI Orchestrator pipeline.
 * Evaluates whether query results adequately answer the user's intent.
 * Includes retry logic for insufficient results.
 */

import { Intent, QueryResults, Evaluation } from '../types/ai-types';
import {
  RESULT_EVALUATION_SYSTEM_PROMPT,
  buildEvaluationPrompt,
} from '../ai-prompts/evaluation-prompts';
import { openai, MODEL_NAMES } from './openai-config';

export class ResultEvaluator {
  private model: string;
  private maxRetries: number;

  constructor(model?: string, maxRetries: number = 2) {
    this.model = model || MODEL_NAMES.evaluation;
    this.maxRetries = maxRetries;
  }

  /**
   * Evaluate query results
   */
  async evaluate(
    intent: Intent,
    results: QueryResults
  ): Promise<Evaluation> {
    try {
      // Quick evaluation for obvious cases
      const quickEval = this.quickEvaluate(intent, results);
      if (quickEval) {
        return quickEval;
      }

      // Use AI for nuanced evaluation
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: RESULT_EVALUATION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildEvaluationPrompt(intent, results, results.workItems.length),
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return this.validateEvaluation(parsed);
    } catch (error) {
      console.error('Error evaluating results:', error);

      // Fallback evaluation
      return this.createFallbackEvaluation(intent, results);
    }
  }

  /**
   * Quick evaluation for obvious cases (no AI needed)
   */
  private quickEvaluate(
    intent: Intent,
    results: QueryResults
  ): Evaluation | null {
    // Case 1: Query failed
    if (results.metadata.failedQueries > 0 && results.metadata.successfulQueries === 0) {
      return {
        dataQuality: 'POOR',
        relevance: 'LOW',
        completeness: 'INCOMPLETE',
        needsAdditional: true,
        additionalQueriesNeeded: ['Retry failed queries with adjusted parameters'],
        insights: [],
        warnings: ['All queries failed'],
        confidence: 0.1,
        reasoning: 'All queries failed - no data retrieved',
      };
    }

    // Case 2: No results for specific item lookup
    if (intent.scope === 'ISSUE' && results.workItems.length === 0) {
      return {
        dataQuality: 'POOR',
        relevance: 'LOW',
        completeness: 'INCOMPLETE',
        needsAdditional: false,
        insights: [],
        warnings: [`Issue #${intent.issueId} not found`],
        confidence: 0.8,
        reasoning: 'Specific issue not found - may not exist or user lacks permissions',
      };
    }

    // Case 3: Got exactly what we asked for (simple query)
    if (
      intent.complexity === 'SIMPLE' &&
      results.workItems.length > 0 &&
      results.metadata.failedQueries === 0
    ) {
      return {
        dataQuality: 'GOOD',
        relevance: 'HIGH',
        completeness: 'COMPLETE',
        needsAdditional: false,
        insights: [
          `Found ${results.workItems.length} items`,
          `All queries executed successfully`,
        ],
        confidence: 0.9,
        reasoning: 'Simple query executed successfully with results',
      };
    }

    // No quick evaluation available
    return null;
  }

  /**
   * Validate the AI evaluation response
   */
  private validateEvaluation(parsed: any): Evaluation {
    return {
      dataQuality: this.validateDataQuality(parsed.dataQuality),
      relevance: this.validateRelevance(parsed.relevance),
      completeness: this.validateCompleteness(parsed.completeness),
      needsAdditional: Boolean(parsed.needsAdditional),
      additionalQueriesNeeded: Array.isArray(parsed.additionalQueriesNeeded)
        ? parsed.additionalQueriesNeeded
        : undefined,
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : undefined,
      confidence: this.normalizeConfidence(parsed.confidence),
      reasoning: parsed.reasoning || 'Evaluation completed',
    };
  }

  private validateDataQuality(quality: string): 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT' {
    const valid = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT'];
    return valid.includes(quality) ? (quality as any) : 'FAIR';
  }

  private validateRelevance(relevance: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const valid = ['LOW', 'MEDIUM', 'HIGH'];
    return valid.includes(relevance) ? (relevance as any) : 'MEDIUM';
  }

  private validateCompleteness(completeness: string): 'INCOMPLETE' | 'PARTIAL' | 'COMPLETE' {
    const valid = ['INCOMPLETE', 'PARTIAL', 'COMPLETE'];
    return valid.includes(completeness) ? (completeness as any) : 'PARTIAL';
  }

  private normalizeConfidence(confidence: any): number {
    const conf = parseFloat(confidence);
    if (isNaN(conf)) return 0.5;
    return Math.max(0, Math.min(1, conf));
  }

  /**
   * Create fallback evaluation when AI fails
   */
  private createFallbackEvaluation(
    intent: Intent,
    results: QueryResults
  ): Evaluation {
    const hasResults = results.workItems.length > 0;
    const allQueriesSucceeded = results.metadata.failedQueries === 0;

    return {
      dataQuality: hasResults && allQueriesSucceeded ? 'GOOD' : 'FAIR',
      relevance: hasResults ? 'MEDIUM' : 'LOW',
      completeness: hasResults ? 'PARTIAL' : 'INCOMPLETE',
      needsAdditional: !hasResults || !allQueriesSucceeded,
      insights: [
        `Found ${results.workItems.length} work items`,
        `${results.metadata.successfulQueries} of ${results.metadata.totalQueries} queries succeeded`,
      ],
      warnings: results.metadata.failedQueries > 0
        ? [`${results.metadata.failedQueries} queries failed`]
        : undefined,
      confidence: 0.5,
      reasoning: 'Fallback evaluation due to AI error',
    };
  }

  /**
   * Determine if results should trigger a retry
   */
  shouldRetry(evaluation: Evaluation, currentAttempt: number): boolean {
    if (currentAttempt >= this.maxRetries) {
      return false;
    }

    // Retry if:
    // 1. Data quality is poor
    // 2. Completeness is incomplete
    // 3. Needs additional data
    // 4. Confidence is very low

    return (
      evaluation.dataQuality === 'POOR' ||
      evaluation.completeness === 'INCOMPLETE' ||
      (evaluation.needsAdditional && evaluation.additionalQueriesNeeded !== undefined) ||
      evaluation.confidence < 0.3
    );
  }

  /**
   * Generate suggestions for retry based on evaluation
   */
  generateRetryStrategy(evaluation: Evaluation, intent: Intent): any {
    const strategy: any = {
      adjustedIntent: { ...intent },
      suggestions: [],
    };

    // If specific queries needed, add them
    if (evaluation.additionalQueriesNeeded) {
      strategy.suggestions = evaluation.additionalQueriesNeeded;
    }

    // If data quality is poor, try broadening the search
    if (evaluation.dataQuality === 'POOR') {
      // Remove some filters
      if (intent.states && intent.states.length > 0) {
        strategy.adjustedIntent.states = undefined;
        strategy.suggestions.push('Removed state filter to broaden search');
      }
    }

    // If relevance is low, try adjusting scope
    if (evaluation.relevance === 'LOW') {
      if (intent.scope === 'SPRINT' && intent.sprintIdentifier) {
        strategy.suggestions.push('Try different sprint or remove sprint filter');
      }
    }

    return strategy;
  }
}

export default ResultEvaluator;
