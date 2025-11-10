/**
 * Unified Chat API Route
 *
 * AI-first endpoint that uses the orchestrator to process all queries.
 * Replaces /api/prompt and /api/search with a single intelligent endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIOrchestrator } from '@/lib/ai-orchestrator';
import { OrchestratorInput } from '@/lib/types/ai-types';
import { GlobalFilters } from '@/types';

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

    // Log AI service configuration
    const aiService = process.env.OPENROUTER_API_KEY ? 'OpenRouter' : 'OpenAI';
    const aiBaseURL = process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.openai.com/v1';

    console.log('[Chat API] Processing query:', {
      query: input.query,
      userId: input.userId,
      conversationId: input.conversationId,
      aiService,
      aiBaseURL,
    });

    // Initialize orchestrator
    const orchestrator = new AIOrchestrator();

    // Process query through orchestrator
    const result = await orchestrator.process(input);

    // Prepare response with explicit JSON serialization
    const response: any = {
      success: result.response.success || false,
      summary: result.response.summary || 'No summary available',
      analysis: result.response.analysis || undefined,
      rawData: result.response.rawData || [],
      suggestions: result.response.suggestions || [],
      visualizations: result.response.visualizations || [],
      metadata: {
        queriesExecuted: result.response.metadata?.queriesExecuted || 0,
        dataSources: result.response.metadata?.dataSources || [],
        confidence: result.response.metadata?.confidence || 0,
        processingTime: result.response.metadata?.processingTime || (Date.now() - startTime),
        cacheHit: result.response.metadata?.cacheHit || false,
      },
      conversationId: result.conversationContext?.conversationId || null,
      error: result.response.error || undefined,
      metrics: undefined as any,
      contextStats: undefined as any,
    };

    // Include metrics if verbose
    if (options?.verbose && result.metrics) {
      response.metrics = result.metrics;
      try {
        const stats = await orchestrator.getContextStats(
          result.conversationContext.conversationId
        );
        response.contextStats = stats;
      } catch (statsError) {
        console.warn('[Chat API] Failed to get context stats:', statsError);
      }
    }

    console.log('[Chat API] Query processed:', {
      success: response.success,
      workItems: response.rawData.length,
      processingTime: response.metadata.processingTime,
      confidence: response.metadata.confidence,
    });

    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Chat API] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorResponse = {
      success: false,
      error: errorMessage,
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
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
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
