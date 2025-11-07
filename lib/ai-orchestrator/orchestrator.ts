/**
 * AI Orchestrator
 *
 * Main orchestrator that coordinates all phases of the AI-first query processing.
 * This is the entry point for all chat interactions.
 */

import {
  OrchestratorInput,
  OrchestratorResult,
  OrchestratorConfig,
  OrchestratorMetrics,
  Intent,
  Decision,
  QueryPlan,
  QueryResults,
  Evaluation,
  OrchestratedResponse,
  ConversationContext,
} from '../types/ai-types';
import { GlobalFilters } from '@/types';
import IntentAnalyzer from './intent-analyzer';
import DecisionEngine from './decision-engine';
import QueryPlanner from './query-planner';
import QueryExecutor from './query-executor';
import ResultEvaluator from './result-evaluator';
import ResponseSynthesizer from './response-synthesizer';
import ContextManager from './context-manager';
import { ADOService } from '../ado-api';

// Default configuration
const DEFAULT_CONFIG: OrchestratorConfig = {
  models: {
    intent: 'gpt-4o-mini',
    decision: 'gpt-4o-mini',
    planning: 'gpt-4o',
    evaluation: 'gpt-4o',
    synthesis: 'gpt-4o',
  },
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    namespace: 'ado',
  },
  context: {
    maxTurns: 10,
    includeWorkItems: true,
  },
  retry: {
    enabled: true,
    maxAttempts: 2,
    backoff: 'exponential',
  },
  performance: {
    timeout: 30000, // 30 seconds
    parallelQueries: true,
  },
};

export class AIOrchestrator {
  private config: OrchestratorConfig;
  private intentAnalyzer: IntentAnalyzer;
  private decisionEngine: DecisionEngine;
  private queryPlanner: QueryPlanner;
  private queryExecutor: QueryExecutor;
  private resultEvaluator: ResultEvaluator;
  private responseSynthesizer: ResponseSynthesizer;
  private contextManager: ContextManager;
  private adoService: ADOService;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize all phase processors
    this.intentAnalyzer = new IntentAnalyzer(this.config.models.intent);
    this.decisionEngine = new DecisionEngine(this.config.models.decision);
    this.queryPlanner = new QueryPlanner(this.config.models.planning);
    this.queryExecutor = new QueryExecutor();
    this.resultEvaluator = new ResultEvaluator(
      this.config.models.evaluation,
      this.config.retry.maxAttempts
    );
    this.responseSynthesizer = new ResponseSynthesizer(this.config.models.synthesis);
    this.contextManager = new ContextManager();

    // Initialize ADO service with environment variables
    const organization = process.env.NEXT_PUBLIC_ADO_ORGANIZATION || '';
    const pat = process.env.ADO_PAT || '';
    const project = process.env.NEXT_PUBLIC_ADO_PROJECT;
    this.adoService = new ADOService(organization, pat, project);
  }

  /**
   * Main entry point: Process a user query through all phases
   */
  async process(input: OrchestratorInput): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const metrics: OrchestratorMetrics[] = [];

    try {
      // Get or create conversation context
      const context = await this.getOrCreateContext(
        input.conversationId,
        input.userId,
        input.filters
      );

      // Check for slash command (fast-path)
      if (IntentAnalyzer.isSlashCommand(input.query)) {
        return await this.processSlashCommand(input, context, metrics);
      }

      // PHASE 1: Analyze Intent
      const intent = await this.executePhase(
        'Intent Analysis',
        () => this.intentAnalyzer.analyze(input.query),
        metrics
      );

      // PHASE 2: Decide Strategy
      const decision = await this.executePhase(
        'Decision Making',
        () => this.decisionEngine.decide(intent, context),
        metrics
      );

      // If no ADO data needed, skip to synthesis
      if (!decision.requiresADO) {
        const response = await this.executePhase(
          'Response Synthesis (No Data)',
          () =>
            this.responseSynthesizer.synthesize(
              intent,
              {
                dataQuality: 'EXCELLENT',
                relevance: 'HIGH',
                completeness: 'COMPLETE',
                needsAdditional: false,
                insights: [],
                confidence: 0.9,
                reasoning: 'General knowledge question',
              },
              { results: [], workItems: [], metadata: { totalQueries: 0, successfulQueries: 0, failedQueries: 0, totalDuration: 0, cacheHits: 0 } }
            ),
          metrics
        );

        // Save turn to context
        await this.contextManager.addTurn(
          context.conversationId,
          input.query,
          intent,
          response
        );

        return {
          response,
          metrics,
          conversationContext: await this.contextManager.getContext(context.conversationId) || context,
        };
      }

      // Fetch metadata if needed for query planning
      let metadata: { sprints?: any[]; users?: string[] } | undefined;
      if (intent.sprintIdentifier || intent.scope === 'SPRINT' || intent.scope === 'PROJECT') {
        try {
          // Get project name from intent, filters, or environment
          const projectName = intent.projectIdentifier || input.filters?.projectName || process.env.NEXT_PUBLIC_ADO_PROJECT;
          const sprints = await this.adoService.getSprints(projectName);
          metadata = { sprints };
          console.log(`[Orchestrator] Fetched ${sprints?.length || 0} sprints for query planning from project: ${projectName}`);
        } catch (error) {
          console.warn('[Orchestrator] Failed to fetch sprint metadata:', error);
          metadata = undefined;
        }
      }

      // PHASE 3: Plan Queries
      const plan = await this.executePhase(
        'Query Planning',
        () => this.queryPlanner.plan(intent, decision, metadata),
        metrics
      );

      // PHASE 4: Execute Queries (with retry logic)
      let results: QueryResults;
      let evaluation: Evaluation;
      let retryAttempt = 0;

      do {
        // Execute queries
        results = await this.executePhase(
          `Query Execution${retryAttempt > 0 ? ` (Retry ${retryAttempt})` : ''}`,
          () =>
            this.queryExecutor.execute(plan, input.filters, {
              skipCache: input.options?.skipCache,
              cacheKey: decision.cacheKey,
            }),
          metrics
        );

        // PHASE 5: Evaluate Results
        evaluation = await this.executePhase(
          `Result Evaluation${retryAttempt > 0 ? ` (Retry ${retryAttempt})` : ''}`,
          () => this.resultEvaluator.evaluate(intent, results),
          metrics
        );

        // Check if we should retry
        if (
          this.config.retry.enabled &&
          this.resultEvaluator.shouldRetry(evaluation, retryAttempt)
        ) {
          retryAttempt++;
          console.log(`[Orchestrator] Retrying query (attempt ${retryAttempt})...`);

          // Generate retry strategy
          const retryStrategy = this.resultEvaluator.generateRetryStrategy(
            evaluation,
            intent
          );

          // Adjust plan based on strategy (simplified for now)
          console.log('[Orchestrator] Retry strategy:', retryStrategy);
        } else {
          break;
        }
      } while (retryAttempt < this.config.retry.maxAttempts);

      // PHASE 6: Synthesize Response
      const response = await this.executePhase(
        'Response Synthesis',
        () => this.responseSynthesizer.synthesize(intent, evaluation, results),
        metrics
      );

      // Save turn to context
      await this.contextManager.addTurn(
        context.conversationId,
        input.query,
        intent,
        response,
        this.config.context.includeWorkItems ? results.workItems : undefined
      );

      // Get updated context
      const updatedContext =
        (await this.contextManager.getContext(context.conversationId)) || context;

      // Add total processing time to metadata
      response.metadata.processingTime = Date.now() - startTime;

      return {
        response,
        metrics,
        conversationContext: updatedContext,
      };
    } catch (error) {
      console.error('[Orchestrator] Error processing query:', error);

      // Return error response
      const errorResponse: OrchestratedResponse = {
        success: false,
        summary:
          'An error occurred while processing your query. Please try again or rephrase your question.',
        rawData: [],
        suggestions: [
          'Show me my active items',
          'List all projects',
          'What users are available?',
        ],
        metadata: {
          queriesExecuted: 0,
          dataSources: [],
          confidence: 0,
          processingTime: Date.now() - startTime,
          cacheHit: false,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      metrics.push({
        phase: 'Error',
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Try to get context even on error
      let context: ConversationContext;
      if (input.conversationId) {
        const existing = await this.contextManager.getContext(input.conversationId);
        context = existing || await this.contextManager.createContext(input.userId, input.filters);
      } else {
        context = await this.contextManager.createContext(input.userId, input.filters);
      }

      return {
        response: errorResponse,
        metrics,
        conversationContext: context,
      };
    }
  }

  /**
   * Process slash command (fast-path, skips some phases)
   */
  private async processSlashCommand(
    input: OrchestratorInput,
    context: ConversationContext,
    metrics: OrchestratorMetrics[]
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();

    // Parse slash command directly
    const intent = IntentAnalyzer.parseSlashCommand(input.query);

    metrics.push({
      phase: 'Intent Analysis (Fast-Path)',
      duration: Date.now() - startTime,
      success: true,
      metadata: { fastPath: true },
    });

    // Quick decision (always needs ADO data for slash commands)
    const decision: Decision = {
      requiresADO: true,
      queriesNeeded: ['WIQL'],
      analysisRequired: [],
      canUseCache: true,
      estimatedComplexity: 2,
      reasoning: 'Slash command fast-path',
    };

    // Plan query
    const plan = await this.queryPlanner.plan(intent, decision);

    // Execute
    const results = await this.queryExecutor.execute(plan, input.filters);

    // Quick evaluation
    const evaluation: Evaluation = {
      dataQuality: results.workItems.length > 0 ? 'GOOD' : 'FAIR',
      relevance: 'HIGH',
      completeness: 'COMPLETE',
      needsAdditional: false,
      insights: [`Found ${results.workItems.length} items`],
      confidence: 0.9,
      reasoning: 'Slash command executed successfully',
    };

    // Synthesize response
    const response = await this.responseSynthesizer.synthesize(intent, evaluation, results);

    // Save turn
    await this.contextManager.addTurn(
      context.conversationId,
      input.query,
      intent,
      response,
      results.workItems
    );

    const updatedContext =
      (await this.contextManager.getContext(context.conversationId)) || context;

    response.metadata.processingTime = Date.now() - startTime;

    return {
      response,
      metrics,
      conversationContext: updatedContext,
    };
  }

  /**
   * Get or create conversation context
   */
  private async getOrCreateContext(
    conversationId: string | undefined,
    userId: string,
    filters?: GlobalFilters
  ): Promise<ConversationContext> {
    if (conversationId) {
      const existing = await this.contextManager.getContext(conversationId);
      if (existing) {
        return existing;
      }
    }

    return await this.contextManager.createContext(userId, filters);
  }

  /**
   * Execute a phase and track metrics
   */
  private async executePhase<T>(
    phaseName: string,
    fn: () => Promise<T>,
    metrics: OrchestratorMetrics[]
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();

      metrics.push({
        phase: phaseName,
        duration: Date.now() - startTime,
        success: true,
      });

      return result;
    } catch (error) {
      metrics.push({
        phase: phaseName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get context statistics
   */
  async getContextStats(conversationId: string): Promise<any> {
    const context = await this.contextManager.getContext(conversationId);
    if (!context) {
      return null;
    }

    return this.contextManager.getStats(context);
  }

  /**
   * Clear conversation context
   */
  async clearContext(conversationId: string): Promise<void> {
    await this.contextManager.deleteContext(conversationId);
  }

  /**
   * Invalidate cache
   */
  async invalidateCache(pattern: string): Promise<void> {
    await this.queryExecutor.invalidateCache(pattern);
  }
}

export default AIOrchestrator;
