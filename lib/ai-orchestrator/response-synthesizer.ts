/**
 * Response Synthesizer
 *
 * Phase 6 of the AI Orchestrator pipeline.
 * Generates comprehensive responses with analysis, visualizations, and suggestions.
 */

import OpenAI from 'openai';
import {
  Intent,
  Evaluation,
  QueryResults,
  OrchestratedResponse,
  AnalysisResult,
  Visualization,
  VisualizationType,
} from '../types/ai-types';
import {
  RESPONSE_SYNTHESIS_SYSTEM_PROMPT,
  buildSynthesisPrompt,
} from '../ai-prompts/synthesis-prompts';
import { WorkItem } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class ResponseSynthesizer {
  private model: string;

  constructor(model: string = 'gpt-4o') {
    this.model = model;
  }

  /**
   * Synthesize final response
   */
  async synthesize(
    intent: Intent,
    evaluation: Evaluation,
    results: QueryResults
  ): Promise<OrchestratedResponse> {
    try {
      const startTime = Date.now();

      // For questions that don't need ADO data, generate simple response
      if (!intent.dataRequired) {
        return this.synthesizeSimpleResponse(intent);
      }

      // Use AI to generate comprehensive response
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: RESPONSE_SYNTHESIS_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildSynthesisPrompt(intent, evaluation, results),
          },
        ],
        temperature: 0.4,
        max_tokens: 3000,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Try to parse as JSON (should be JSON from synthesis prompt)
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        // If not JSON, treat as plain text summary
        parsed = { summary: content };
      }

      // Build orchestrated response
      const orchestratedResponse: OrchestratedResponse = {
        success: true,
        summary: parsed.summary || this.generateFallbackSummary(intent, results),
        analysis: parsed.analysis ? this.validateAnalysis(parsed.analysis) : undefined,
        rawData: results.workItems,
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : this.generateDefaultSuggestions(intent),
        visualizations: Array.isArray(parsed.visualizations)
          ? this.validateVisualizations(parsed.visualizations, results.workItems)
          : this.generateAutoVisualizations(intent, results.workItems),
        metadata: {
          queriesExecuted: results.metadata.totalQueries,
          dataSources: ['Azure DevOps'],
          confidence: evaluation.confidence,
          processingTime: Date.now() - startTime,
          cacheHit: results.metadata.cacheHits > 0,
        },
      };

      return orchestratedResponse;
    } catch (error) {
      console.error('Error synthesizing response:', error);

      // Fallback response
      return this.createFallbackResponse(intent, results, evaluation);
    }
  }

  /**
   * Synthesize simple response for questions not requiring ADO data
   */
  private async synthesizeSimpleResponse(intent: Intent): Promise<OrchestratedResponse> {
    // Generate answer to general question using AI
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions about Azure DevOps concepts and terminology. Be concise but thorough.',
          },
          {
            role: 'user',
            content: intent.originalQuery,
          },
        ],
        temperature: 0.5,
        max_tokens: 800,
      });

      const answer = response.choices[0].message.content || 'I can help answer questions about Azure DevOps.';

      return {
        success: true,
        summary: answer,
        rawData: [],
        suggestions: [
          'Show me my active work items',
          'What sprints are available?',
          'List all projects',
        ],
        metadata: {
          queriesExecuted: 0,
          dataSources: ['General Knowledge'],
          confidence: 0.9,
          processingTime: 0,
          cacheHit: false,
        },
      };
    } catch (error) {
      return {
        success: true,
        summary: 'I can help you explore Azure DevOps data. Try asking about specific work items, sprints, users, or projects.',
        rawData: [],
        suggestions: [
          'Show me my assigned items',
          'List all users',
          'What are the available work item types?',
        ],
        metadata: {
          queriesExecuted: 0,
          dataSources: [],
          confidence: 0.5,
          processingTime: 0,
          cacheHit: false,
        },
      };
    }
  }

  /**
   * Validate and structure analysis result
   */
  private validateAnalysis(parsed: any): AnalysisResult {
    return {
      title: parsed.title || 'Analysis',
      summary: parsed.summary || '',
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : undefined,
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : undefined,
    };
  }

  /**
   * Validate visualizations and ensure data is present
   */
  private validateVisualizations(
    visuals: any[],
    workItems: WorkItem[]
  ): Visualization[] {
    return visuals
      .filter((v) => v.type && v.title && v.data)
      .map((v) => ({
        type: v.type as VisualizationType,
        title: v.title,
        data: v.data,
        config: v.config,
      }))
      .slice(0, 3); // Max 3 visualizations
  }

  /**
   * Auto-generate visualizations based on intent and data
   */
  private generateAutoVisualizations(
    intent: Intent,
    workItems: WorkItem[]
  ): Visualization[] {
    if (workItems.length === 0) {
      return [];
    }

    const visualizations: Visualization[] = [];

    // Status distribution (always useful)
    const statusData = this.aggregateByField(workItems, 'System.State');
    if (Object.keys(statusData).length > 0) {
      visualizations.push({
        type: 'status_pie',
        title: 'Work Item Status Distribution',
        data: statusData,
      });
    }

    // Priority distribution (if priority data exists)
    const priorityData = this.aggregateByField(workItems, 'Microsoft.VSTS.Common.Priority');
    if (Object.keys(priorityData).length > 1) {
      visualizations.push({
        type: 'priority_distribution',
        title: 'Priority Distribution',
        data: priorityData,
      });
    }

    // Sprint-specific: burndown or velocity
    if (intent.scope === 'SPRINT' && intent.type === 'ANALYSIS') {
      // Would need sprint dates and story points for true burndown
      // For now, just show completion status
      const completedCount = workItems.filter(
        (w) => w.state === 'Closed' || w.state === 'Resolved'
      ).length;
      const totalCount = workItems.length;

      visualizations.push({
        type: 'burndown',
        title: 'Sprint Progress',
        data: {
          completed: completedCount,
          remaining: totalCount - completedCount,
          total: totalCount,
          percentage: Math.round((completedCount / totalCount) * 100),
        },
      });
    }

    return visualizations.slice(0, 3); // Max 3
  }

  /**
   * Aggregate work items by a field
   */
  private aggregateByField(workItems: WorkItem[], fieldName: string): Record<string, number> {
    const counts: Record<string, number> = {};

    // Map ADO field names to WorkItem properties
    const fieldMap: Record<string, keyof WorkItem> = {
      'System.State': 'state',
      'System.WorkItemType': 'type',
      'Microsoft.VSTS.Common.Priority': 'priority',
      'System.AssignedTo': 'assignedTo',
      'System.CreatedBy': 'createdBy',
    };

    const propertyName = fieldMap[fieldName] || fieldName as keyof WorkItem;

    workItems.forEach((item) => {
      if (!item) return;

      const value = item[propertyName];
      if (value !== undefined && value !== null) {
        const key = String(value);
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    return counts;
  }

  /**
   * Generate fallback summary when AI fails
   */
  private generateFallbackSummary(intent: Intent, results: QueryResults): string {
    const count = results.workItems.length;

    if (count === 0) {
      return 'No work items found matching your query.';
    }

    if (intent.scope === 'USER' && intent.userIdentifier) {
      return `Found ${count} work item${count !== 1 ? 's' : ''} for ${intent.userIdentifier}.`;
    }

    if (intent.scope === 'SPRINT' && intent.sprintIdentifier) {
      return `Found ${count} work item${count !== 1 ? 's' : ''} in ${intent.sprintIdentifier}.`;
    }

    if (intent.scope === 'ISSUE' && intent.issueId) {
      return count > 0
        ? `Found work item #${intent.issueId}.`
        : `Work item #${intent.issueId} not found.`;
    }

    return `Found ${count} work item${count !== 1 ? 's' : ''} matching your query.`;
  }

  /**
   * Generate default suggestions based on intent
   */
  private generateDefaultSuggestions(intent: Intent): string[] {
    const suggestions: string[] = [];

    if (intent.scope === 'USER') {
      suggestions.push(
        'Show high priority items',
        'What bugs are assigned?',
        'Show items by state'
      );
    } else if (intent.scope === 'SPRINT') {
      suggestions.push(
        'Show blocked items',
        'What is the velocity?',
        'Who has the most items?'
      );
    } else if (intent.scope === 'PROJECT') {
      suggestions.push(
        'Show all bugs',
        'List active sprints',
        'Show team breakdown'
      );
    } else {
      suggestions.push(
        'Show my active items',
        'List all sprints',
        'What users are available?'
      );
    }

    return suggestions.slice(0, 4);
  }

  /**
   * Create fallback response when synthesis fails
   */
  private createFallbackResponse(
    intent: Intent,
    results: QueryResults,
    evaluation: Evaluation
  ): OrchestratedResponse {
    return {
      success: true,
      summary: this.generateFallbackSummary(intent, results),
      rawData: results.workItems,
      suggestions: this.generateDefaultSuggestions(intent),
      visualizations: this.generateAutoVisualizations(intent, results.workItems),
      metadata: {
        queriesExecuted: results.metadata.totalQueries,
        dataSources: ['Azure DevOps'],
        confidence: evaluation.confidence,
        processingTime: results.metadata.totalDuration,
        cacheHit: results.metadata.cacheHits > 0,
      },
    };
  }

  /**
   * Calculate metrics for analysis
   */
  calculateMetrics(workItems: WorkItem[], intent: Intent): any {
    const metrics: any = {};

    // Total count
    metrics.totalItems = workItems.length;

    // State distribution
    const states: Record<string, number> = {};
    workItems.forEach((item) => {
      if (!item) return;
      const state = item.state;
      if (state) {
        states[state] = (states[state] || 0) + 1;
      }
    });
    metrics.states = states;

    // Type distribution
    const types: Record<string, number> = {};
    workItems.forEach((item) => {
      if (!item) return;
      const type = item.type;
      if (type) {
        types[type] = (types[type] || 0) + 1;
      }
    });
    metrics.types = types;

    // Sprint-specific metrics
    if (intent.scope === 'SPRINT') {
      const storyPoints = workItems
        .filter((item) => item)
        .map((item) => item.storyPoints || 0)
        .reduce((sum, points) => sum + points, 0);

      metrics.totalStoryPoints = storyPoints;
      metrics.completedStoryPoints = workItems
        .filter(
          (item) =>
            item &&
            (item.state === 'Closed' || item.state === 'Resolved')
        )
        .map((item) => item.storyPoints || 0)
        .reduce((sum, points) => sum + points, 0);

      metrics.blockedCount = workItems.filter(
        (item) => item && item.state === 'Blocked'
      ).length;
    }

    return metrics;
  }
}

export default ResponseSynthesizer;
