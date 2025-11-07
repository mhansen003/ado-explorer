/**
 * Unified Chat API Route
 *
 * AI-first endpoint that uses the orchestrator to process all queries.
 * Replaces /api/prompt and /api/search with a single intelligent endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIOrchestrator } from '@/lib/ai-orchestrator';
import { OrchestratorInput } from '@/lib/types/ai-types';
import { GlobalFilters } from '@/lib/types/index';

export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds max

/**
 * POST /api/chat
 *
 * Process a user query through the AI orchestrator.
 *
 * Request body:
 * {
 *   query: string;              // User's question or command
 *   conversationId?: string;    // Optional conversation ID for context
 *   userId: string;             // User ID
 *   filters?: GlobalFilters;    // Optional global filters
 *   options?: {
 *     skipCache?: boolean;      // Force fresh data
 *     verbose?: boolean;        // Include debug metrics
 *   }
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   summary: string;                    // AI-generated summary
 *   analysis?: AnalysisResult;          // Detailed analysis if applicable
 *   rawData: WorkItem[];                // Work items data
 *   suggestions: string[];              // Follow-up suggestions
 *   visualizations?: Visualization[];   // Auto-generated charts
 *   metadata: {
 *     queriesExecuted: number;
 *     dataSources: string[];
 *     confidence: number;
 *     processingTime: number;
 *     cacheHit: boolean;
 *   };
 *   conversationId: string;             // Current conversation ID
 *   metrics?: OrchestratorMetrics[];    // Detailed phase metrics (if verbose)
 * }
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await req.json();
    const { query, conversationId, userId, filters, options } = body;

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prepare orchestrator input
    const input: OrchestratorInput = {
      query: query.trim(),
      conversationId,
      userId,
      filters: filters as GlobalFilters | undefined,
      options: {
        skipCache: options?.skipCache || false,
        verbose: options?.verbose || false,
      },
    };

    console.log('[Chat API] Processing query:', {
      query: input.query,
      userId: input.userId,
      conversationId: input.conversationId,
    });

    // Initialize orchestrator
    const orchestrator = new AIOrchestrator();

    // Process query through orchestrator
    const result = await orchestrator.process(input);

    // Prepare response
    const response: any = {
      success: result.response.success,
      summary: result.response.summary,
      analysis: result.response.analysis,
      rawData: result.response.rawData,
      suggestions: result.response.suggestions,
      visualizations: result.response.visualizations,
      metadata: result.response.metadata,
      conversationId: result.conversationContext.conversationId,
      error: result.response.error,
    };

    // Include metrics if verbose
    if (options?.verbose) {
      response.metrics = result.metrics;
      response.contextStats = orchestrator.getContextStats(
        result.conversationContext.conversationId
      );
    }

    console.log('[Chat API] Query processed:', {
      success: result.response.success,
      workItems: result.response.rawData.length,
      processingTime: Date.now() - startTime,
      confidence: result.response.metadata.confidence,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Chat API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        summary: 'An error occurred while processing your request. Please try again.',
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
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat?conversationId=xxx
 *
 * Get conversation statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const orchestrator = new AIOrchestrator();
    const stats = await orchestrator.getContextStats(conversationId);

    if (!stats) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Chat API] Error getting stats:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat?conversationId=xxx
 *
 * Clear conversation context
 */
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const orchestrator = new AIOrchestrator();
    await orchestrator.clearContext(conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat API] Error clearing context:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
